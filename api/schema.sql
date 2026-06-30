-- Esquema de la base de datos · Mundial 2026 · Mis Láminas (API amigos)
-- Importar en Cloudways (phpMyAdmin) o:  mysql -u USER -p DB < schema.sql

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  google_sub  VARCHAR(64)  NOT NULL,                 -- id de la cuenta Google
  email       VARCHAR(255) DEFAULT NULL,
  name        VARCHAR(120) DEFAULT NULL,
  handle      VARCHAR(40)  NOT NULL,                 -- código público para agregar amigos
  avatar_url  VARCHAR(512) DEFAULT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_sub (google_sub),
  UNIQUE KEY uniq_handle (handle),
  KEY idx_email (email)                              -- buscar amigos por correo
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Migración para DBs ya existentes (idempotente vía IF NOT EXISTS desde MySQL 8):
--   ALTER TABLE users ADD INDEX idx_email (email);

-- Colección de cada usuario. Solo se guardan láminas con qty>=1.
-- La ausencia de una fila = lámina faltante.
CREATE TABLE IF NOT EXISTS collection (
  user_id     BIGINT UNSIGNED NOT NULL,
  sid         VARCHAR(24) NOT NULL,                  -- id estable de lámina, ej. ALG-5, INTRO-3
  qty         SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, sid),
  KEY idx_sid (sid),
  CONSTRAINT fk_coll_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Amistades. Se guardan dos filas (una por dirección) al aceptar.
CREATE TABLE IF NOT EXISTS friendships (
  user_id     BIGINT UNSIGNED NOT NULL,
  friend_id   BIGINT UNSIGNED NOT NULL,
  status      ENUM('pending','accepted','blocked') NOT NULL DEFAULT 'pending',
  watch       TINYINT(1) NOT NULL DEFAULT 1,          -- ¿vigilo a este amigo para avisos de match?
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, friend_id),
  KEY idx_friend (friend_id),
  CONSTRAINT fk_fr_user   FOREIGN KEY (user_id)   REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_fr_friend FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Notificaciones de match: una "viva" por (usuario, amigo). Se rellena con
-- refresh_notifications() al cruzar repes/faltantes de amigos vigilados.
CREATE TABLE IF NOT EXISTS notifications (
  user_id     BIGINT UNSIGNED NOT NULL,               -- destinatario del aviso
  friend_id   BIGINT UNSIGNED NOT NULL,               -- amigo del match
  they_give   INT UNSIGNED NOT NULL DEFAULT 0,         -- cuántas me puede pasar (me faltan)
  i_give      INT UNSIGNED NOT NULL DEFAULT 0,         -- cuántas le paso yo
  sig         CHAR(32) NOT NULL DEFAULT '',            -- firma del set "they_give_me" (evita repetir)
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at     DATETIME DEFAULT NULL,                   -- NULL = no leída
  pushed_at   DATETIME DEFAULT NULL,                   -- último envío de push (para no repetir)
  PRIMARY KEY (user_id, friend_id),
  KEY idx_user_unread (user_id, read_at),
  CONSTRAINT fk_no_user   FOREIGN KEY (user_id)   REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_no_friend FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Suscripciones de Web Push (una por navegador/dispositivo).
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  endpoint    VARCHAR(512) NOT NULL,                   -- URL del push service (FCM, Mozilla, etc.)
  p256dh      VARCHAR(255) NOT NULL,
  auth        VARCHAR(255) NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_endpoint (endpoint(191)),
  KEY idx_user (user_id),
  CONSTRAINT fk_ps_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
