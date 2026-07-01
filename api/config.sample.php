<?php
/*
 * Copia este archivo como  config.php  y completa tus datos.
 * config.php NO se sube al repo (está en .gitignore).
 *
 * Los datos de la base de datos están en Cloudways:
 *   Application → Access Details → MySQL Access
 */
return [
  'db' => [
    'host'    => '127.0.0.1',
    'name'    => 'TU_DB_NAME',
    'user'    => 'TU_DB_USER',
    'pass'    => 'TU_DB_PASS',
    'charset' => 'utf8mb4',
  ],

  // Client ID de Google (Google Cloud Console → Credenciales → OAuth Web).
  // Termina en .apps.googleusercontent.com
  'google_client_id' => 'TU_CLIENT_ID.apps.googleusercontent.com',

  // Secreto largo y aleatorio para firmar las sesiones (JWT propio).
  // Genera uno con:  php -r "echo bin2hex(random_bytes(32));"
  'jwt_secret'   => 'CAMBIA_ESTO_POR_UN_SECRETO_LARGO',
  'jwt_ttl_days' => 30,

  // Orígenes del frontend permitidos (CORS).
  'allowed_origins' => [
    'https://pixelperfect-cl.github.io',
    'http://localhost:8000',
  ],

  // Correos con acceso al panel de admin (/admin.html, /admin/stats, /admin/users.csv).
  // Debe ser el correo con que inicias sesión en la app con Google.
  'admin_emails' => [
    'tucorreo@gmail.com',
  ],

  // Web Push (VAPID). Genera las llaves con:
  //   php -r "require 'vendor/autoload.php'; var_dump(Minishlink\\WebPush\\VAPID::createVapidKeys());"
  // La clave 'public' también va en app.js (PUSH_VAPID_PUBLIC).
  'vapid' => [
    'subject' => 'mailto:tucorreo@ejemplo.com',
    'public'  => 'TU_VAPID_PUBLIC',
    'private' => 'TU_VAPID_PRIVATE',
  ],
];
