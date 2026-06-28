<?php
/* Verificación del ID token de Google y sesión propia. */

// Verifica el ID token con el endpoint público de Google.
// Devuelve los datos (sub, email, name, picture) o null si es inválido.
function google_verify($idToken) {
  if (!$idToken) return null;
  $cfg = config();
  $url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($idToken);

  $data = null;
  if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_TIMEOUT        => 8,
    ]);
    $resp = curl_exec($ch);
    curl_close($ch);
    if ($resp !== false) $data = json_decode($resp, true);
  } else {
    $ctx = stream_context_create(['http' => ['timeout' => 8, 'ignore_errors' => true]]);
    $resp = @file_get_contents($url, false, $ctx);
    if ($resp !== false) $data = json_decode($resp, true);
  }

  if (!is_array($data) || empty($data['sub'])) return null;
  if (($data['aud'] ?? '') !== $cfg['google_client_id']) return null;   // token de otra app
  return $data;
}

// Devuelve el payload de la sesión (uid, handle) o null.
function current_user() {
  $token = bearer_token();
  if (!$token) return null;
  $payload = jwt_verify($token);
  if (!$payload || empty($payload['uid'])) return null;
  return $payload;
}

function require_user() {
  $u = current_user();
  if (!$u) fail('No autorizado', 401);
  return $u;
}
