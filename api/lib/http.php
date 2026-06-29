<?php
/* Helpers de configuración, CORS y respuestas JSON. */

function config() {
  static $c = null;
  if ($c === null) {
    $path = __DIR__ . '/../config.php';
    if (!file_exists($path)) {
      http_response_code(500);
      header('Content-Type: application/json; charset=utf-8');
      echo json_encode(['error' => 'Falta config.php en el servidor']);
      exit;
    }
    $c = require $path;
  }
  return $c;
}

function cors() {
  $cfg = config();
  $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
  if ($origin && in_array($origin, $cfg['allowed_origins'], true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Vary: Origin');
  }
  header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
  header('Access-Control-Allow-Headers: Content-Type, Authorization');
  header('Access-Control-Max-Age: 86400');
  if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
  }
}

function body_json() {
  $raw = file_get_contents('php://input');
  if ($raw === '' || $raw === false) return [];
  $d = json_decode($raw, true);
  return is_array($d) ? $d : [];
}

function json_out($data, $code = 200) {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  // La API es dinámica: que ni Varnish (Cloudways) ni el navegador la cacheen.
  header('Cache-Control: no-store');
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

function fail($msg, $code = 400) {
  json_out(['error' => $msg], $code);
}
