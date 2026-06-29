<?php
/* Envío de Web Push (VAPID) con minishlink/web-push. */

require_once __DIR__ . '/../vendor/autoload.php';

use Minishlink\WebPush\WebPush;
use Minishlink\WebPush\Subscription;

/*
 * Envía un push a TODAS las suscripciones de :uid con el $payload dado
 * (array con title/body/url). Limpia las suscripciones caducadas (410/404).
 * Devuelve cuántos envíos resultaron exitosos.
 */
function send_push_to_user($pdo, $uid, $payload) {
  $cfg = config();
  if (empty($cfg['vapid']['public']) || empty($cfg['vapid']['private'])) return 0;

  $rows = $pdo->prepare('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?');
  $rows->execute([$uid]);
  $subs = $rows->fetchAll();
  if (!$subs) return 0;

  $webPush = new WebPush(['VAPID' => [
    'subject'    => $cfg['vapid']['subject'],
    'publicKey'  => $cfg['vapid']['public'],
    'privateKey' => $cfg['vapid']['private'],
  ]]);

  $json = json_encode($payload, JSON_UNESCAPED_UNICODE);
  $byEndpoint = [];
  foreach ($subs as $s) {
    try {
      $byEndpoint[$s['endpoint']] = $s['id'];
      $sub = Subscription::create([
        'endpoint' => $s['endpoint'],
        'keys'     => ['p256dh' => $s['p256dh'], 'auth' => $s['auth']],
      ]);
      $webPush->queueNotification($sub, $json);
    } catch (\Throwable $e) { /* suscripción inválida: se ignora */ }
  }

  $sent = 0;
  $del = $pdo->prepare('DELETE FROM push_subscriptions WHERE id = ?');
  try {
    foreach ($webPush->flush() as $report) {
      if ($report->isSuccess()) {
        $sent++;
      } elseif ($report->isSubscriptionExpired()) {
        $ep = $report->getEndpoint();
        if (isset($byEndpoint[$ep])) $del->execute([$byEndpoint[$ep]]);
      }
    }
  } catch (\Throwable $e) { /* no romper el flujo por un fallo de envío */ }
  return $sent;
}
