# API · Mundial 2026 · Mis Láminas

Backend en **PHP plano** (stack *Custom PHP* de Cloudways) + **MySQL**, con login
**Google** y un sistema de **amigos** para cruzar láminas faltantes/repetidas.

## Estructura

```
api/
  index.php          ← front-controller (todas las rutas)
  config.sample.php  ← copiar a config.php y completar
  schema.sql         ← tablas (importar en MySQL)
  .htaccess          ← rewrite + protección de archivos
  lib/
    http.php  db.php  jwt.php  util.php  auth.php
```

## Puesta en marcha (Cloudways)

1. **Subir el código** al webroot de la app (`public_html`). Puedes:
   - conectar el repo por Git en Cloudways y apuntar el deploy a la carpeta `api/`, **o**
   - subir el contenido de `api/` por SFTP a `public_html`.

2. **Base de datos**: en *Application → Access Details* copia el nombre/usuario/clave
   de MySQL. Importa el esquema (phpMyAdmin → Import `schema.sql`, o por consola):
   ```bash
   mysql -u USUARIO -p NOMBRE_DB < schema.sql
   ```

3. **Configuración**: copia `config.sample.php` a `config.php` y completa:
   - credenciales de la DB,
   - `google_client_id` (ver paso 4),
   - `jwt_secret` aleatorio: `php -r "echo bin2hex(random_bytes(32));"`,
   - `allowed_origins` con la URL del frontend (ej. `https://pixelperfect-cl.github.io`).

4. **Google Sign-In**: en [Google Cloud Console](https://console.cloud.google.com/)
   → *APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth*
   → tipo **Aplicación web**. En *Orígenes autorizados de JavaScript* agrega la URL del
   **frontend** (no la de la API). Copia el *Client ID* a `config.php`.

5. **PHP**: usa PHP 8.x en Cloudways. Requiere las extensiones `pdo_mysql` y `curl`
   (vienen activas por defecto).

## Probar

```bash
curl https://TU-APP.cloudwaysapps.com/        # → {"ok":true,"service":"mundilaminas-api"}
```

## Rutas

| Método | Ruta                       | Auth | Cuerpo / query            |
|--------|----------------------------|------|---------------------------|
| GET    | `/`                        | —    | health check              |
| POST   | `/auth/google`             | —    | `{ id_token }`            |
| GET    | `/me`                      | ✔    | —                         |
| PUT    | `/me/collection`           | ✔    | `{ counts: { sid: qty } }`|
| POST   | `/friends/request`         | ✔    | `{ handle }`              |
| POST   | `/friends/accept`          | ✔    | `{ handle }`              |
| GET    | `/friends`                 | ✔    | —                         |
| GET    | `/friends/matches?with=`   | ✔    | `?with=handle`            |

Auth = enviar `Authorization: Bearer <token>` (el token lo entrega `/auth/google`).

## IDs de lámina (`sid`)

El frontend envía un identificador **estable** por lámina, independiente del orden:
- Introducción → `INTRO-1` … `INTRO-9`
- FIFA Museum  → `MUSEUM-1` … `MUSEUM-11`
- Equipos      → `CODIGO-slot`, ej. `ALG-5`, `BRA-1`, `MEX-13`

El cruce con un amigo es una intersección: *él te da* las láminas que tiene
repetidas (`qty>=2`) y a ti te faltan; *tú le das* las que tú tienes repetidas y a
él le faltan.
