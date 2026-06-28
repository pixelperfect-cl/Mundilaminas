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
