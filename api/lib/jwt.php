<?php
/* JWT propio (HS256) para las sesiones — sin dependencias externas. */

function b64url($s)     { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function b64url_dec($s) { return base64_decode(strtr($s, '-_', '+/')); }

function jwt_make($payload) {
  $secret = config()['jwt_secret'];
  $seg = [
    b64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT'])),
    b64url(json_encode($payload)),
  ];
  $sig = hash_hmac('sha256', implode('.', $seg), $secret, true);
  $seg[] = b64url($sig);
  return implode('.', $seg);
}

function jwt_verify($jwt) {
  $secret = config()['jwt_secret'];
  $parts = explode('.', $jwt);
  if (count($parts) !== 3) return null;
  [$h, $p, $s] = $parts;
  $expected = b64url(hash_hmac('sha256', "$h.$p", $secret, true));
  if (!hash_equals($expected, $s)) return null;
  $payload = json_decode(b64url_dec($p), true);
  if (!is_array($payload)) return null;
  if (isset($payload['exp']) && time() >= $payload['exp']) return null;
  return $payload;
}
