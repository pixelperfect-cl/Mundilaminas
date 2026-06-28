# ⚽ Mundial 2026 · Mis Láminas

App simple y **standalone** (sin login, sin internet) para llevar el control de tu
álbum **Panini FIFA World Cup 2026 Official Sticker Collection**: marca qué láminas
tienes, cuántas repetidas, y genera las listas de **lo que te falta** y **tus repetidas**
para cambiar con amigos.

## Cómo usarla

No necesita instalación ni servidor. Abre `index.html` en el navegador del teléfono o PC:

- **Marcar láminas**: en cada equipo, usa `+` y `−`. El número del centro es **cuántas
  copias tienes**:
  - `·` (gris) → te **falta**
  - `1` (verde) → la **tienes**
  - `2`, `3`… (dorado, badge `+N`) → la tienes + **N repetidas**
- **Filtros**: `Todas` · `Me faltan` · `Repetidas`.
- **Buscar**: por número (`25`) o por equipo (`Brasil`).
- **📋 Mis listas**: genera el texto de "me faltan" y "repetidas" para **compartir
  directo por WhatsApp** 🟢, **copiar** o **compartir** por el menú nativo. Las listas
  incluyen la **bandera de cada país** 🇧🇷 🇦🇷 para que se lean fácil en el chat.
- **⚙️ Menú**:
  - **Respaldo**: exporta/importa un archivo `.json` (para no perder datos o pasarlos
    a otro teléfono — los datos viven en este navegador).
  - **Editar equipos**: corrige grupo / nombre / código de cada selección para que
    calce con tu álbum físico. La numeración se recalcula sola y tus marcas se conservan.

## Estructura del álbum (980 láminas)

| Sección        | Láminas | Números   |
|----------------|---------|-----------|
| Introducción   | 9       | 1 – 9     |
| FIFA Museum    | 11      | 10 – 20   |
| 48 equipos     | 960     | 21 – 980  |

Cada equipo trae 20 láminas: **escudo** (✨ brillante), **plantel**, y **18 jugadores**.

> ✅ **Equipos y grupos**: corresponden al **sorteo final oficial** del Mundial 2026
> (Washington D.C., 5 dic 2025) con los repechajes ya resueltos. Si algo no calza con
> tu álbum físico, lo corriges desde **⚙️ Menú → Editar equipos** (la numeración se
> recalcula sola y tus marcas se conservan).

## Datos / privacidad

Todo se guarda **localmente** en tu navegador (`localStorage`). No se envía nada a
ningún servidor. Haz respaldos desde el menú si te importa no perder el avance.

## Stack

HTML + CSS + JavaScript puro (sin dependencias ni build). Archivos:
`index.html`, `styles.css`, `data.js` (estructura del álbum), `app.js` (lógica).
