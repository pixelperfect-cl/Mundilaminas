<?php
/* Conexión PDO a MySQL (una sola por request). */

function db() {
  static $pdo = null;
  if ($pdo) return $pdo;
  $d = config()['db'];
  $dsn = "mysql:host={$d['host']};dbname={$d['name']};charset={$d['charset']}";
  try {
    $pdo = new PDO($dsn, $d['user'], $d['pass'], [
      PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
      PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
  } catch (PDOException $e) {
    fail('Error de conexión a la base de datos', 500);
  }
  return $pdo;
}
