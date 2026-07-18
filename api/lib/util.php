<?php
/* Utilidades: usuarios, handles, token Bearer y cálculo de coincidencias. */

function public_user($u) {
  return [
    'id'         => (int)$u['id'],
    'handle'     => $u['handle'],
    'name'       => $u['name'] ?? null,
    'avatar_url' => $u['avatar_url'] ?? null,
  ];
}

function fetch_user($pdo, $id) {
  $s = $pdo->prepare('SELECT * FROM users WHERE id = ?');
  $s->execute([$id]);
  return $s->fetch();
}

function slugify($s) {
  $s = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', (string)$s);
  $s = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '', $s));
  return $s !== '' ? $s : 'jugador';
}

// Genera un handle único, ej: "juan-4f2a"
function make_handle($name, $pdo) {
  $base = substr(slugify($name), 0, 20);
  for ($i = 0; $i < 8; $i++) {
    $h = $base . '-' . substr(bin2hex(random_bytes(2)), 0, 4);
    $s = $pdo->prepare('SELECT 1 FROM users WHERE handle = ?');
    $s->execute([$h]);
    if (!$s->fetch()) return $h;
  }
  return $base . '-' . bin2hex(random_bytes(4));
}

// Lee el token del header Authorization (con fallbacks para Apache/Cloudways).
function bearer_token() {
  $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
  if (!$h && function_exists('apache_request_headers')) {
    foreach (apache_request_headers() as $k => $v) {
      if (strtolower($k) === 'authorization') { $h = $v; break; }
    }
  }
  return (stripos($h, 'Bearer ') === 0) ? substr($h, 7) : '';
}

// Genera un código único para shared_albums.join_code. La columna es NOT NULL
// UNIQUE en la tabla viva, así que hay que llenarla, pero el código ya no se
// expone al cliente (la unión a un álbum es solo por invitación entre amigos).
function make_join_code($pdo) {
  for ($i = 0; $i < 10; $i++) {
    $c = strtoupper(bin2hex(random_bytes(3)));   // 6 hex en mayúscula
    $s = $pdo->prepare('SELECT 1 FROM shared_albums WHERE join_code = ?');
    $s->execute([$c]);
    if (!$s->fetch()) return $c;
  }
  return strtoupper(bin2hex(random_bytes(6)));
}

// Resumen de un álbum para el cliente (con dueño y nº de miembros).
function album_brief($pdo, $alb, $myRole, $ownerUser = null) {
  if (!$ownerUser) $ownerUser = fetch_user($pdo, $alb['owner_id']);
  $c = $pdo->prepare('SELECT COUNT(*) FROM shared_album_members WHERE album_id = ?');
  $c->execute([$alb['id']]);
  return [
    'id'           => (int)$alb['id'],
    'name'         => $alb['name'],
    'owner_handle' => $ownerUser['handle'] ?? null,
    'owner_name'   => $ownerUser['name'] ?? null,
    'role'         => $myRole,
    'members'      => (int)$c->fetchColumn(),
  ];
}

// Devuelve la fila del álbum + mi rol si soy miembro; si no, false.
function album_membership($pdo, $albumId, $uid) {
  $s = $pdo->prepare(
    'SELECT a.id, a.owner_id, a.name, m.role
       FROM shared_albums a
       JOIN shared_album_members m ON m.album_id = a.id AND m.user_id = ?
      WHERE a.id = ?'
  );
  $s->execute([$uid, $albumId]);
  return $s->fetch();
}

// Crea/actualiza una dirección de amistad.
function set_friend($pdo, $a, $b, $status) {
  $s = $pdo->prepare(
    'INSERT INTO friendships(user_id, friend_id, status, created_at) VALUES(?,?,?,NOW())
     ON DUPLICATE KEY UPDATE status = VALUES(status)'
  );
  $s->execute([$a, $b, $status]);
}

/*
 * Calcula las dos listas de intercambio entre :me y :fr.
 *   they_give_me: él tiene repetida (qty>=2) y yo no la tengo.
 *   i_give_them : yo tengo repetida (qty>=2) y él no la tiene.
 */
function compute_matches($pdo, $me, $fr) {
  $q1 = $pdo->prepare(
    'SELECT f.sid FROM collection f
       LEFT JOIN collection m ON m.user_id = ? AND m.sid = f.sid
      WHERE f.user_id = ? AND f.qty >= 2 AND (m.sid IS NULL OR m.qty = 0)
      ORDER BY f.sid'
  );
  $q1->execute([$me, $fr]);
  $they = array_map(fn($r) => $r['sid'], $q1->fetchAll());

  $q2 = $pdo->prepare(
    'SELECT m.sid FROM collection m
       LEFT JOIN collection f ON f.user_id = ? AND f.sid = m.sid
      WHERE m.user_id = ? AND m.qty >= 2 AND (f.sid IS NULL OR f.qty = 0)
      ORDER BY m.sid'
  );
  $q2->execute([$fr, $me]);
  $mine = array_map(fn($r) => $r['sid'], $q2->fetchAll());

  return ['they_give_me' => $they, 'i_give_them' => $mine];
}

/*
 * Recalcula las notificaciones de match para los amigos VIGILADOS de :uid.
 * Crea/actualiza una notificación por amigo cuando él tiene repetidas que me
 * faltan (they_give_me). Solo se "re-enciende" (vuelve a no leída) si ahora me
 * puede dar MÁS que antes, para no ser molesto.
 * Reutilizable por un cron (push/email) o on-demand al pedir /notifications.
 */
function refresh_notifications($pdo, $uid) {
  $f = $pdo->prepare(
    "SELECT friend_id FROM friendships
      WHERE user_id = ? AND status = 'accepted' AND watch = 1"
  );
  $f->execute([$uid]);
  $friendIds = array_map(fn($r) => (int)$r['friend_id'], $f->fetchAll());

  $upsert = $pdo->prepare(
    "INSERT INTO notifications(user_id, friend_id, they_give, i_give, sig, created_at, read_at)
       VALUES(?,?,?,?,?,NOW(),NULL)
     ON DUPLICATE KEY UPDATE
       read_at    = IF(VALUES(they_give) > they_give, NULL, read_at),
       created_at = IF(VALUES(they_give) > they_give, NOW(), created_at),
       they_give  = VALUES(they_give),
       i_give     = VALUES(i_give),
       sig        = VALUES(sig)"
  );
  $del = $pdo->prepare('DELETE FROM notifications WHERE user_id = ? AND friend_id = ?');

  foreach ($friendIds as $fid) {
    $m = compute_matches($pdo, $uid, $fid);
    $they = $m['they_give_me'];
    if (!count($they)) { $del->execute([$uid, $fid]); continue; }
    $sig = md5(implode(',', $they));
    $upsert->execute([$uid, $fid, count($they), count($m['i_give_them']), $sig]);
  }
}

// Lee las notificaciones de :uid (con datos del amigo) y cuántas no leídas hay.
function fetch_notifications($pdo, $uid) {
  $s = $pdo->prepare(
    "SELECT n.they_give, n.i_give, n.read_at, n.created_at,
            u.handle, u.name, u.avatar_url
       FROM notifications n JOIN users u ON u.id = n.friend_id
      WHERE n.user_id = ?
      ORDER BY (n.read_at IS NULL) DESC, n.created_at DESC"
  );
  $s->execute([$uid]);
  $items = []; $unread = 0;
  foreach ($s as $r) {
    $isUnread = ($r['read_at'] === null);
    if ($isUnread) $unread++;
    $items[] = [
      'friend'     => ['handle' => $r['handle'], 'name' => $r['name'], 'avatar_url' => $r['avatar_url']],
      'they_give'  => (int)$r['they_give'],
      'i_give'     => (int)$r['i_give'],
      'unread'     => $isUnread,
      'created_at' => $r['created_at'],
    ];
  }
  return ['unread' => $unread, 'items' => $items];
}
