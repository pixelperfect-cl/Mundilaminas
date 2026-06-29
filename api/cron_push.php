<?php
/*
 * cron_push.php — recalcula notificaciones de match para todos los usuarios que
 * vigilan a alguien y envía un Web Push por cada novedad aún no avisada.
 * Pensado para correr por cron cada pocos minutos. Solo CLI.
 * Cron instalado: cada 5 minutos (ver "crontab -l").
 */
if (PHP_SAPI !== 'cli') { http_response_code(403); exit('CLI only'); }

require __DIR__ . '/lib/http.php';
require __DIR__ . '/lib/db.php';
require __DIR__ . '/lib/util.php';
require __DIR__ . '/lib/push.php';

$pdo = db();

// 1) Recalcular notificaciones para todos los que vigilan a algún amigo.
$users = $pdo->query(
  "SELECT DISTINCT user_id FROM friendships WHERE status = 'accepted' AND watch = 1"
)->fetchAll();
foreach ($users as $u) {
  refresh_notifications($pdo, (int)$u['user_id']);
}

// 2) Enviar push por cada notificación no leída y aún no avisada (o re-encendida).
$pending = $pdo->query(
  "SELECT n.user_id, n.friend_id, n.they_give, n.i_give, u.name, u.handle
     FROM notifications n JOIN users u ON u.id = n.friend_id
    WHERE n.read_at IS NULL AND (n.pushed_at IS NULL OR n.pushed_at < n.created_at)"
)->fetchAll();

$mark = $pdo->prepare('UPDATE notifications SET pushed_at = NOW() WHERE user_id = ? AND friend_id = ?');
$sent = 0;
foreach ($pending as $p) {
  $who  = $p['name'] !== null && $p['name'] !== '' ? $p['name'] : ('@' . $p['handle']);
  $body = "$who tiene {$p['they_give']} lámina(s) que te faltan"
        . ($p['i_give'] ? " · tú le pasas {$p['i_give']}" : '');
  $sent += send_push_to_user($pdo, (int)$p['user_id'], [
    'title' => '🔔 Mundial 2026 · Mis Láminas',
    'body'  => $body,
    'url'   => 'https://pixelperfect-cl.github.io/Mundilaminas/',
  ]);
  $mark->execute([$p['user_id'], $p['friend_id']]);
}

echo date('c') . " cron_push: users=" . count($users) . " pending=" . count($pending) . " sent=$sent\n";
