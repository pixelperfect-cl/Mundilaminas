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
  UNIQUE KEY uniq_handle (handle)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, friend_id),
  KEY idx_friend (friend_id),
  CONSTRAINT fk_fr_user   FOREIGN KEY (user_id)   REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_fr_friend FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
