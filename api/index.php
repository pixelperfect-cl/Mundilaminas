<?php
/*
 * API · Mundial 2026 · Mis Láminas
 * PHP plano (Custom PHP en Cloudways) + MySQL. Front-controller único.
 *
 * Rutas:
 *   GET  /                       → health check
 *   POST /auth/google            → { id_token } → { token, user }
 *   GET  /me                     → perfil + colección { counts }
 *   PUT  /me/collection          → { counts: { sid: qty } }  (delta)
 *   DELETE /me                   → borra la cuenta y todos sus datos (cascada)
 *   POST /friends/request        → { handle } o { email }
 *   POST /friends/accept         → { handle }
 *   GET  /friends                → amigos (con nº de coincidencias) + solicitudes
 *   GET  /friends/matches?with=  → listas de intercambio con un amigo
 *
 *   Álbumes compartidos (pool = collection del dueño). Solo se invita a
 *   amigos ya aceptados (no hay códigos ni links de unión):
 *   POST /albums/share           → crea/devuelve mi álbum compartido
 *   GET  /albums/mine            → álbumes donde soy dueño o miembro
 *   GET  /albums/{id}            → metadata + miembros
 *   GET  /albums/{id}/collection?since=<ts> → { counts, ts } (incremental)
 *   POST /albums/{id}/collection → { ops:[{sid,delta}] } edición por deltas
 *   POST /albums/{id}/invite     → { handle } (dueño; solo amigos aceptados)
 *   POST /albums/{id}/leave|kick|delete
 */

require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/jwt.php';
require_once __DIR__ . '/lib/util.php';
require_once __DIR__ . '/lib/auth.php';

cors();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
// Ruta relativa a la ubicación de index.php, así funciona igual si la API
// queda en la raíz del webroot o dentro de una subcarpeta (ej. /api).
$uriPath   = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
if ($scriptDir !== '' && strpos($uriPath, $scriptDir) === 0) {
  $uriPath = substr($uriPath, strlen($scriptDir));
}
$path = trim($uriPath, '/');

// ---------- Health ----------
if ($method === 'GET' && $path === '') {
  json_out(['ok' => true, 'service' => 'mundilaminas-api', 'v' => 1]);
}

// ---------- Auth con Google ----------
if ($method === 'POST' && $path === 'auth/google') {
  $in = body_json();
  $g = google_verify($in['id_token'] ?? '');
  if (!$g) fail('Token de Google inválido', 401);

  $pdo = db();
  $s = $pdo->prepare('SELECT * FROM users WHERE google_sub = ?');
  $s->execute([$g['sub']]);
  $user = $s->fetch();

  if (!$user) {
    $handle = make_handle($g['name'] ?? 'jugador', $pdo);
    $ins = $pdo->prepare(
      'INSERT INTO users(google_sub, email, name, handle, avatar_url, created_at)
       VALUES(?,?,?,?,?,NOW())'
    );
    $ins->execute([$g['sub'], $g['email'] ?? null, $g['name'] ?? null, $handle, $g['picture'] ?? null]);
    $user = fetch_user($pdo, $pdo->lastInsertId());
  }

  $token = jwt_make([
    'uid'    => (int)$user['id'],
    'handle' => $user['handle'],
    'exp'    => time() + 86400 * (int)config()['jwt_ttl_days'],
  ]);
  json_out(['token' => $token, 'user' => public_user($user)]);
}

// ---------- Mi perfil + colección ----------
if ($method === 'GET' && $path === 'me') {
  $me   = require_user();
  $pdo  = db();
  $user = fetch_user($pdo, $me['uid']);
  if (!$user) fail('Usuario no encontrado', 404);

  $rows = $pdo->prepare('SELECT sid, qty FROM collection WHERE user_id = ?');
  $rows->execute([$me['uid']]);
  $counts = [];
  foreach ($rows as $r) $counts[$r['sid']] = (int)$r['qty'];

  json_out(['user' => public_user($user), 'counts' => $counts]);
}

// ---------- Subir mi colección (delta) ----------
if ($method === 'PUT' && $path === 'me/collection') {
  $me = require_user();
  $in = body_json();
  $counts = $in['counts'] ?? null;
  if (!is_array($counts)) fail('Falta "counts"');

  $pdo = db();
  $pdo->beginTransaction();
  $up  = $pdo->prepare(
    'INSERT INTO collection(user_id, sid, qty, updated_at) VALUES(?,?,?,NOW())
     ON DUPLICATE KEY UPDATE qty = VALUES(qty), updated_at = NOW()'
  );
  $del = $pdo->prepare('DELETE FROM collection WHERE user_id = ? AND sid = ?');
  foreach ($counts as $sid => $qty) {
    $sid = substr((string)$sid, 0, 24);
    if ($sid === '') continue;
    $qty = (int)$qty;
    if ($qty <= 0) $del->execute([$me['uid'], $sid]);
    else           $up->execute([$me['uid'], $sid, min($qty, 9999)]);
  }
  $pdo->commit();
  json_out(['ok' => true, 'saved' => count($counts)]);
}

// ---------- Borrar mi cuenta y todos mis datos (irreversible) ----------
// Cumple el requisito de "eliminación de cuenta" de Google Play. El borrado
// del usuario cae en cascada (ON DELETE CASCADE) sobre collection, friendships
// (ambas direcciones), notifications (ambas) y push_subscriptions.
if ($method === 'DELETE' && $path === 'me') {
  $me  = require_user();
  $pdo = db();
  $d = $pdo->prepare('DELETE FROM users WHERE id = ?');
  $d->execute([$me['uid']]);
  json_out(['ok' => true, 'deleted' => true]);
}

// ---------- Solicitar amistad (por código @handle o por correo) ----------
if ($method === 'POST' && $path === 'friends/request') {
  $me = require_user();
  $in = body_json();
  $handle = ltrim(trim($in['handle'] ?? ''), '@');
  $email  = trim($in['email'] ?? '');
  if ($handle === '' && $email === '') fail('Falta el código o correo del amigo');

  $pdo = db();
  if ($email !== '') {
    // Búsqueda por correo (collation por defecto = case-insensitive, usa idx_email).
    $t = $pdo->prepare('SELECT id, handle, name, avatar_url FROM users WHERE email = ? LIMIT 1');
    $t->execute([$email]);
  } else {
    $t = $pdo->prepare('SELECT id, handle, name, avatar_url FROM users WHERE handle = ?');
    $t->execute([$handle]);
  }
  $target = $t->fetch();
  if (!$target) fail('No existe un usuario con ese código o correo', 404);
  if ((int)$target['id'] === (int)$me['uid']) fail('No puedes agregarte a ti mismo');

  // ¿El otro ya me había solicitado? → aceptar automáticamente.
  $r = $pdo->prepare("SELECT status FROM friendships WHERE user_id = ? AND friend_id = ?");
  $r->execute([$target['id'], $me['uid']]);
  $reverse = $r->fetch();

  if ($reverse && $reverse['status'] !== 'blocked') {
    set_friend($pdo, $me['uid'], $target['id'], 'accepted');
    set_friend($pdo, $target['id'], $me['uid'], 'accepted');
    json_out(['status' => 'accepted', 'friend' => public_user($target)]);
  }
  set_friend($pdo, $me['uid'], $target['id'], 'pending');
  json_out(['status' => 'pending', 'friend' => public_user($target)]);
}

// ---------- Aceptar solicitud ----------
if ($method === 'POST' && $path === 'friends/accept') {
  $me = require_user();
  $in = body_json();
  $handle = trim($in['handle'] ?? '');
  if ($handle === '') fail('Falta el handle');

  $pdo = db();
  $t = $pdo->prepare('SELECT id, handle, name, avatar_url FROM users WHERE handle = ?');
  $t->execute([$handle]);
  $other = $t->fetch();
  if (!$other) fail('Usuario no encontrado', 404);

  // Debe existir una solicitud pendiente de ese usuario hacia mí.
  $r = $pdo->prepare("SELECT status FROM friendships WHERE user_id = ? AND friend_id = ?");
  $r->execute([$other['id'], $me['uid']]);
  $req = $r->fetch();
  if (!$req || $req['status'] !== 'pending') fail('No hay una solicitud pendiente de ese usuario', 404);

  set_friend($pdo, $me['uid'], $other['id'], 'accepted');
  set_friend($pdo, $other['id'], $me['uid'], 'accepted');
  json_out(['status' => 'accepted', 'friend' => public_user($other)]);
}

// ---------- Lista de amigos + solicitudes ----------
if ($method === 'GET' && $path === 'friends') {
  $me  = require_user();
  $pdo = db();

  $f = $pdo->prepare(
    "SELECT u.id, u.handle, u.name, u.avatar_url, fr.watch
       FROM friendships fr JOIN users u ON u.id = fr.friend_id
      WHERE fr.user_id = ? AND fr.status = 'accepted'
      ORDER BY u.name, u.handle"
  );
  $f->execute([$me['uid']]);
  $friends = [];
  foreach ($f as $row) {
    $m = compute_matches($pdo, $me['uid'], $row['id']);
    $friends[] = [
      'user'         => public_user($row),
      'they_give_me' => count($m['they_give_me']),
      'i_give_them'  => count($m['i_give_them']),
      'watch'        => (bool)$row['watch'],
    ];
  }

  // Solicitudes entrantes (alguien me pidió y aún no acepto).
  $p = $pdo->prepare(
    "SELECT u.id, u.handle, u.name, u.avatar_url
       FROM friendships fr JOIN users u ON u.id = fr.user_id
      WHERE fr.friend_id = ? AND fr.status = 'pending'
        AND NOT EXISTS (
          SELECT 1 FROM friendships f2
           WHERE f2.user_id = ? AND f2.friend_id = fr.user_id AND f2.status = 'accepted')"
  );
  $p->execute([$me['uid'], $me['uid']]);
  $incoming = array_map(fn($r) => public_user($r), $p->fetchAll());

  json_out(['friends' => $friends, 'incoming' => $incoming]);
}

// ---------- Coincidencias con un amigo ----------
if ($method === 'GET' && $path === 'friends/matches') {
  $me  = require_user();
  $handle = trim($_GET['with'] ?? '');
  if ($handle === '') fail('Falta ?with=handle');

  $pdo = db();
  $t = $pdo->prepare('SELECT id, handle, name, avatar_url FROM users WHERE handle = ?');
  $t->execute([$handle]);
  $friend = $t->fetch();
  if (!$friend) fail('Amigo no encontrado', 404);

  // Confirmar que somos amigos aceptados.
  $c = $pdo->prepare("SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ? AND status = 'accepted'");
  $c->execute([$me['uid'], $friend['id']]);
  if (!$c->fetch()) fail('No son amigos todavía', 403);

  $m = compute_matches($pdo, $me['uid'], $friend['id']);
  json_out(['with' => public_user($friend)] + $m);
}

// ---------- Vigilar / dejar de vigilar a un amigo ----------
if ($method === 'POST' && $path === 'friends/watch') {
  $me = require_user();
  $in = body_json();
  $handle = trim($in['handle'] ?? '');
  $on = !empty($in['on']) ? 1 : 0;
  if ($handle === '') fail('Falta el handle');

  $pdo = db();
  $t = $pdo->prepare('SELECT id FROM users WHERE handle = ?');
  $t->execute([$handle]);
  $fr = $t->fetch();
  if (!$fr) fail('Usuario no encontrado', 404);

  $s = $pdo->prepare("UPDATE friendships SET watch = ? WHERE user_id = ? AND friend_id = ? AND status = 'accepted'");
  $s->execute([$on, $me['uid'], $fr['id']]);
  if (!$on) {
    $d = $pdo->prepare('DELETE FROM notifications WHERE user_id = ? AND friend_id = ?');
    $d->execute([$me['uid'], $fr['id']]);
  }
  json_out(['ok' => true, 'watch' => (bool)$on]);
}

// ---------- Notificaciones de match ----------
if ($method === 'GET' && $path === 'notifications') {
  $me = require_user();
  $pdo = db();
  refresh_notifications($pdo, $me['uid']);
  json_out(fetch_notifications($pdo, $me['uid']));
}

if ($method === 'POST' && $path === 'notifications/read') {
  $me = require_user();
  $in = body_json();
  $pdo = db();
  if (!empty($in['all'])) {
    $s = $pdo->prepare('UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL');
    $s->execute([$me['uid']]);
  } else {
    $handle = trim($in['handle'] ?? '');
    if ($handle === '') fail('Falta "handle" o "all"');
    $t = $pdo->prepare('SELECT id FROM users WHERE handle = ?');
    $t->execute([$handle]);
    $fr = $t->fetch();
    if ($fr) {
      $s = $pdo->prepare('UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND friend_id = ? AND read_at IS NULL');
      $s->execute([$me['uid'], $fr['id']]);
    }
  }
  json_out(['ok' => true]);
}

// ---------- Web Push: suscribir / desuscribir ----------
if ($method === 'POST' && $path === 'push/subscribe') {
  $me  = require_user();
  $in  = body_json();
  $sub = $in['subscription'] ?? $in;            // acepta {subscription:{...}} o el objeto directo
  $endpoint = $sub['endpoint'] ?? '';
  $p256dh   = $sub['keys']['p256dh'] ?? '';
  $auth     = $sub['keys']['auth'] ?? '';
  if (!$endpoint || !$p256dh || !$auth) fail('Suscripción de push inválida');

  $pdo = db();
  $s = $pdo->prepare(
    'INSERT INTO push_subscriptions(user_id, endpoint, p256dh, auth, created_at)
       VALUES(?,?,?,?,NOW())
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth)'
  );
  $s->execute([$me['uid'], $endpoint, $p256dh, $auth]);

  // Push de bienvenida para confirmar de inmediato que funciona.
  try {
    require_once __DIR__ . '/lib/push.php';
    send_push_to_user($pdo, $me['uid'], [
      'title' => '🔔 Avisos activados',
      'body'  => 'Te avisaremos cuando un amigo tenga láminas que te faltan.',
      'url'   => '/index.html',
    ]);
  } catch (\Throwable $e) { /* el alta igual fue exitosa */ }
  json_out(['ok' => true]);
}

if ($method === 'POST' && $path === 'push/unsubscribe') {
  $me = require_user();
  $in = body_json();
  $endpoint = $in['endpoint'] ?? '';
  $pdo = db();
  if ($endpoint) {
    $s = $pdo->prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?');
    $s->execute([$me['uid'], $endpoint]);
  } else {
    $s = $pdo->prepare('DELETE FROM push_subscriptions WHERE user_id = ?');
    $s->execute([$me['uid']]);
  }
  json_out(['ok' => true]);
}

// ---------- Álbumes compartidos ----------
if (strpos($path, 'albums') === 0) {
  $me  = require_user();
  $pdo = db();

  // Compartir mi álbum (idempotente): crea/devuelve mi shared_album.
  // El join_code se sigue generando porque la columna es NOT NULL/UNIQUE en la
  // tabla viva, pero ya no se expone ni se usa (la unión es solo por invitación).
  if ($method === 'POST' && $path === 'albums/share') {
    $user = fetch_user($pdo, $me['uid']);
    $s = $pdo->prepare('SELECT id, owner_id, name FROM shared_albums WHERE owner_id = ?');
    $s->execute([$me['uid']]);
    $alb = $s->fetch();
    if (!$alb) {
      $name = 'Álbum de ' . ($user['name'] ?: ('@' . $user['handle']));
      $code = make_join_code($pdo);
      $pdo->beginTransaction();
      $ins = $pdo->prepare('INSERT INTO shared_albums(owner_id, name, join_code, created_at) VALUES(?,?,?,NOW())');
      $ins->execute([$me['uid'], mb_substr($name, 0, 80), $code]);
      $albumId = (int)$pdo->lastInsertId();
      $m = $pdo->prepare("INSERT INTO shared_album_members(album_id, user_id, role, joined_at)
                          VALUES(?,?, 'owner', NOW()) ON DUPLICATE KEY UPDATE role = 'owner'");
      $m->execute([$albumId, $me['uid']]);
      $pdo->commit();
      $s->execute([$me['uid']]); $alb = $s->fetch();
    }
    json_out(['album' => album_brief($pdo, $alb, 'owner', $user)]);
  }

  // Mis álbumes (donde soy dueño o miembro).
  if ($method === 'GET' && $path === 'albums/mine') {
    $q = $pdo->prepare(
      "SELECT a.id, a.owner_id, a.name, m.role
         FROM shared_album_members m JOIN shared_albums a ON a.id = m.album_id
        WHERE m.user_id = ? ORDER BY (m.role = 'owner') DESC, a.created_at"
    );
    $q->execute([$me['uid']]);
    $albums = array_map(fn($a) => album_brief($pdo, $a, $a['role']), $q->fetchAll());
    json_out(['albums' => $albums]);
  }

  // /albums/{id} y sub-recursos (solo miembros).
  $parts = explode('/', $path);
  if (isset($parts[1]) && ctype_digit($parts[1])) {
    $albumId = (int)$parts[1];
    $sub     = $parts[2] ?? '';
    $mem = album_membership($pdo, $albumId, $me['uid']);
    if (!$mem) fail('No eres miembro de ese álbum', 403);
    $ownerId = (int)$mem['owner_id'];
    $isOwner = ($mem['role'] === 'owner');

    // Metadata + miembros.
    if ($method === 'GET' && $sub === '') {
      $mm = $pdo->prepare(
        "SELECT u.handle, u.name, u.avatar_url, m.role
           FROM shared_album_members m JOIN users u ON u.id = m.user_id
          WHERE m.album_id = ? ORDER BY (m.role = 'owner') DESC, u.name, u.handle"
      );
      $mm->execute([$albumId]);
      json_out(['album' => album_brief($pdo, $mem, $mem['role']), 'members' => $mm->fetchAll()]);
    }

    // Leer la colección compartida (= collection del dueño), con ?since incremental.
    if ($method === 'GET' && $sub === 'collection') {
      $since = isset($_GET['since']) ? (int)$_GET['since'] : 0;
      if ($since > 0) {
        $r = $pdo->prepare('SELECT sid, qty FROM collection WHERE user_id = ? AND updated_at > FROM_UNIXTIME(?)');
        $r->execute([$ownerId, $since]);
      } else {
        $r = $pdo->prepare('SELECT sid, qty FROM collection WHERE user_id = ?');
        $r->execute([$ownerId]);
      }
      $counts = [];
      foreach ($r as $row) $counts[$row['sid']] = (int)$row['qty'];
      $ts = (int)$pdo->query('SELECT UNIX_TIMESTAMP()')->fetchColumn();
      json_out(['counts' => $counts, 'ts' => $ts]);
    }

    // Editar por deltas. NO se borran filas en qty 0 (se deja qty=0 para el polling).
    if ($method === 'POST' && $sub === 'collection') {
      $in  = body_json();
      $ops = $in['ops'] ?? null;
      if (!is_array($ops)) fail('Falta "ops"');
      $pdo->beginTransaction();
      $up = $pdo->prepare(
        'INSERT INTO collection(user_id, sid, qty, updated_at) VALUES(?,?,GREATEST(0,?),NOW())
         ON DUPLICATE KEY UPDATE qty = GREATEST(0, CAST(qty AS SIGNED) + ?), updated_at = NOW()'
      );
      $touched = [];
      foreach ($ops as $op) {
        $sid = substr((string)($op['sid'] ?? ''), 0, 24);
        if ($sid === '') continue;
        $delta = (int)($op['delta'] ?? 0);
        if ($delta === 0) continue;
        $delta = max(-9999, min(9999, $delta));
        $up->execute([$ownerId, $sid, $delta, $delta]);
        $touched[$sid] = true;
      }
      $pdo->commit();
      $counts = [];
      if ($touched) {
        $sids = array_keys($touched);
        $ph = implode(',', array_fill(0, count($sids), '?'));
        $q = $pdo->prepare("SELECT sid, qty FROM collection WHERE user_id = ? AND sid IN ($ph)");
        $q->execute(array_merge([$ownerId], $sids));
        foreach ($q as $row) $counts[$row['sid']] = (int)$row['qty'];
      }
      $ts = (int)$pdo->query('SELECT UNIX_TIMESTAMP()')->fetchColumn();
      json_out(['ok' => true, 'counts' => $counts, 'ts' => $ts]);
    }

    // Invitar a un amigo (dueño): como ya hay amistad aceptada, entra directo
    // como miembro y se le avisa por push. Idempotente si ya era miembro.
    if ($method === 'POST' && $sub === 'invite') {
      if (!$isOwner) fail('Solo el dueño puede invitar', 403);
      $in = body_json();
      $handle = ltrim(trim($in['handle'] ?? ''), '@');
      if ($handle === '') fail('Falta el handle');
      $t = $pdo->prepare('SELECT id, handle, name, avatar_url FROM users WHERE handle = ?');
      $t->execute([$handle]);
      $u = $t->fetch();
      if (!$u) fail('Usuario no encontrado', 404);
      if ((int)$u['id'] === $ownerId) fail('Ya eres el dueño del álbum');
      $c = $pdo->prepare("SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ? AND status = 'accepted'");
      $c->execute([$me['uid'], $u['id']]);
      if (!$c->fetch()) fail('Solo puedes invitar a amigos ya agregados', 403);
      $m = $pdo->prepare("INSERT INTO shared_album_members(album_id, user_id, role, joined_at)
                          VALUES(?,?, 'member', NOW()) ON DUPLICATE KEY UPDATE role = role");
      $m->execute([$albumId, $u['id']]);
      try {
        require_once __DIR__ . '/lib/push.php';
        $meUser = fetch_user($pdo, $me['uid']);
        send_push_to_user($pdo, (int)$u['id'], [
          'title' => '📒 Te sumaron a un álbum',
          'body'  => ($meUser['name'] ?: ('@' . $meUser['handle'])) . ' compartió su álbum contigo. Míralo en 👥 Amigos → Mis álbumes.',
          'url'   => '/',
        ]);
      } catch (\Throwable $e) { /* la invitación igual quedó */ }
      json_out(['ok' => true, 'member' => public_user($u)]);
    }

    // Salir (miembro).
    if ($method === 'POST' && $sub === 'leave') {
      if ($isOwner) fail('El dueño no puede salir; borra el álbum', 400);
      $d = $pdo->prepare('DELETE FROM shared_album_members WHERE album_id = ? AND user_id = ?');
      $d->execute([$albumId, $me['uid']]);
      json_out(['ok' => true]);
    }

    // Sacar a un miembro (dueño).
    if ($method === 'POST' && $sub === 'kick') {
      if (!$isOwner) fail('Solo el dueño puede sacar miembros', 403);
      $in = body_json();
      $handle = ltrim(trim($in['handle'] ?? ''), '@');
      if ($handle === '') fail('Falta el handle');
      $t = $pdo->prepare('SELECT id FROM users WHERE handle = ?');
      $t->execute([$handle]);
      $u = $t->fetch();
      if (!$u) fail('Usuario no encontrado', 404);
      if ((int)$u['id'] === $ownerId) fail('No puedes sacar al dueño');
      $d = $pdo->prepare('DELETE FROM shared_album_members WHERE album_id = ? AND user_id = ?');
      $d->execute([$albumId, $u['id']]);
      json_out(['ok' => true]);
    }

    // Borrar el álbum (dueño). La collection del dueño se conserva.
    if ($method === 'POST' && $sub === 'delete') {
      if (!$isOwner) fail('Solo el dueño puede borrar el álbum', 403);
      $d = $pdo->prepare('DELETE FROM shared_albums WHERE id = ?');   // cascade borra miembros
      $d->execute([$albumId]);
      json_out(['ok' => true]);
    }
  }

  fail('Ruta de álbum no encontrada', 404);
}

// ---------- Admin: estadísticas (solo correos en 'admin_emails') ----------
if ($method === 'GET' && $path === 'admin/stats') {
  require_admin();
  $pdo = db();
  $TOTAL = 994;   // láminas del álbum (coincide con data.js: 9 intro + 11 museum + 14 coca + 960 equipos)
  $q = fn($sql) => $pdo->query($sql)->fetchColumn();
  $st = [];

  // Usuarios
  $st['users_total'] = (int)$q('SELECT COUNT(*) FROM users');
  $st['users_today'] = (int)$q('SELECT COUNT(*) FROM users WHERE created_at >= CURDATE()');
  $st['users_7d']    = (int)$q('SELECT COUNT(*) FROM users WHERE created_at >= (NOW() - INTERVAL 7 DAY)');
  $st['users_30d']   = (int)$q('SELECT COUNT(*) FROM users WHERE created_at >= (NOW() - INTERVAL 30 DAY)');

  // Altas por día (últimos 14 días)
  $rows = $pdo->query(
    "SELECT DATE(created_at) d, COUNT(*) c FROM users
      WHERE created_at >= (CURDATE() - INTERVAL 13 DAY)
      GROUP BY DATE(created_at) ORDER BY d"
  )->fetchAll();
  $st['signups_by_day'] = array_map(fn($r) => ['date' => $r['d'], 'count' => (int)$r['c']], $rows);

  // Actividad (colección tocada recientemente)
  $st['active_7d']  = (int)$q('SELECT COUNT(DISTINCT user_id) FROM collection WHERE updated_at >= (NOW() - INTERVAL 7 DAY)');
  $st['active_30d'] = (int)$q('SELECT COUNT(DISTINCT user_id) FROM collection WHERE updated_at >= (NOW() - INTERVAL 30 DAY)');

  // Push
  $st['push_users']        = (int)$q('SELECT COUNT(DISTINCT user_id) FROM push_subscriptions');
  $st['push_subscriptions'] = (int)$q('SELECT COUNT(*) FROM push_subscriptions');

  // Amistades (friendships es bidireccional → /2 para pares)
  $st['friend_pairs']      = intdiv((int)$q("SELECT COUNT(*) FROM friendships WHERE status='accepted'"), 2);
  $st['friend_pending']    = (int)$q("SELECT COUNT(*) FROM friendships WHERE status='pending'");

  // Colección
  $st['users_with_any']  = (int)$q('SELECT COUNT(DISTINCT user_id) FROM collection');
  $st['stickers_logged'] = (int)$q('SELECT COALESCE(SUM(qty),0) FROM collection');
  $st['dupes_total']     = (int)$q('SELECT COALESCE(SUM(qty-1),0) FROM collection WHERE qty >= 2');
  $st['total_stickers']  = $TOTAL;

  // Avance promedio (láminas distintas poseídas / total), sobre quienes tienen colección
  $avg = $pdo->query(
    'SELECT AVG(cnt) FROM (SELECT user_id, COUNT(*) cnt FROM collection WHERE qty >= 1 GROUP BY user_id) t'
  )->fetchColumn();
  $avgOwned = $avg !== null ? (float)$avg : 0;
  $st['avg_owned']         = round($avgOwned, 1);
  $st['avg_completion_pct'] = $TOTAL ? round(($avgOwned / $TOTAL) * 100, 1) : 0;

  // Top usuarios por completitud
  $top = $pdo->query(
    "SELECT u.handle, u.name, u.created_at,
            COALESCE(c.owned,0) owned, COALESCE(c.total,0) total_qty
       FROM users u
       LEFT JOIN (SELECT user_id, COUNT(*) owned, SUM(qty) total
                    FROM collection WHERE qty >= 1 GROUP BY user_id) c ON c.user_id = u.id
      ORDER BY owned DESC, u.created_at ASC
      LIMIT 15"
  )->fetchAll();
  $st['top_users'] = array_map(fn($r) => [
    'handle'     => $r['handle'],
    'name'       => $r['name'],
    'owned'      => (int)$r['owned'],
    'total_qty'  => (int)$r['total_qty'],
    'pct'        => round(((int)$r['owned'] / $TOTAL) * 100, 1),
    'created_at' => $r['created_at'],
  ], $top);

  json_out($st);
}

// ---------- Admin: export CSV de usuarios ----------
if ($method === 'GET' && $path === 'admin/users.csv') {
  require_admin();
  $pdo = db();
  $rows = $pdo->query(
    "SELECT u.id, u.handle, u.name, u.email, u.created_at,
            COALESCE(c.owned,0) owned, COALESCE(c.total,0) total_qty,
            COALESCE(c.dupes,0) dupes, c.last_activity,
            COALESCE(f.friends,0) friends,
            (SELECT COUNT(*) FROM push_subscriptions ps WHERE ps.user_id = u.id) push
       FROM users u
       LEFT JOIN (SELECT user_id, COUNT(*) owned, SUM(qty) total,
                         SUM(GREATEST(qty-1,0)) dupes, MAX(updated_at) last_activity
                    FROM collection GROUP BY user_id) c ON c.user_id = u.id
       LEFT JOIN (SELECT user_id, COUNT(*) friends
                    FROM friendships WHERE status='accepted' GROUP BY user_id) f ON f.user_id = u.id
      ORDER BY u.created_at ASC"
  )->fetchAll();

  header('Content-Type: text/csv; charset=utf-8');
  header('Content-Disposition: attachment; filename="mundilaminas-usuarios.csv"');
  header('Cache-Control: no-store');
  $out = fopen('php://output', 'w');
  fwrite($out, "\xEF\xBB\xBF");   // BOM para que Excel lea UTF-8
  fputcsv($out, ['id','handle','nombre','email','registrado','laminas_distintas','laminas_totales','repes','ultima_actividad','amigos','push']);
  foreach ($rows as $r) {
    fputcsv($out, [
      $r['id'], $r['handle'], $r['name'], $r['email'], $r['created_at'],
      (int)$r['owned'], (int)$r['total_qty'], (int)$r['dupes'], $r['last_activity'] ?? '',
      (int)$r['friends'], ((int)$r['push'] ? 'sí' : 'no'),
    ]);
  }
  fclose($out);
  exit;
}

fail('Ruta no encontrada', 404);
