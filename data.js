/*
 * Álbum Panini FIFA World Cup 2026 — estructura de la colección.
 *
 * Total: 994 láminas
 *   - 9  láminas de Introducción (foil/brillantes)  → FW0, FWC1–FWC8
 *   - 11 láminas FIFA Museum (leyendas)             → FWC9–FWC19
 *   - 14 láminas Colección Coca-Cola (LatAm)        → CC1–CC14
 *   - 48 equipos × 20 láminas = 960
 *
 * Los 48 equipos y sus grupos (A-L) corresponden al SORTEO FINAL OFICIAL
 * del Mundial 2026 (Washington D.C., 5 dic 2025), con los repechajes ya
 * resueltos. Igual puedes editar cualquier equipo desde la app (botón ✏️)
 * para que calce exactamente con tu álbum físico. La numeración se recalcula sola.
 *
 * Numeración MOSTRADA:
 *   Especiales:  su código impreso (FW0, FWC1–FWC19, CC1–CC14)
 *   Equipos:     1 – 20 por equipo (escudo=1, foto plantel=13, resto jugadores)
 *
 * Dentro de cada equipo (20 láminas):
 *   slot 1  -> Escudo (brillante)
 *   slot 2  -> Foto del plantel
 *   slot 3..20 -> Jugadores (18)
 */

// Láminas de introducción (brillantes/foil). El número que se MUESTRA es el
// código impreso en el álbum (FW0, FWC1…), NO un 1,2,3 correlativo.
// { code: código impreso, label: qué es }
const INTRO_STICKERS = [
  { code: 'FW0',  label: 'Logo Panini' },
  { code: 'FWC1', label: 'Copa (parte superior)' },
  { code: 'FWC2', label: 'Copa (parte inferior)' },
  { code: 'FWC3', label: 'Mascotas (Maple · Zayu · Clutch)' },
  { code: 'FWC4', label: 'Eslogan oficial' },
  { code: 'FWC5', label: 'Balón oficial (Trionda)' },
  { code: 'FWC6', label: 'Sede: Canadá' },
  { code: 'FWC7', label: 'Sede: México' },
  { code: 'FWC8', label: 'Sede: Estados Unidos' },
];

// 11 láminas FIFA Museum (campeones históricos), códigos FWC9–FWC19.
// OJO: los rótulos son los CAMPEONES por año; si tu álbum los nombra por
// SEDE+año (Suiza 1954, Chile 1962…) se cambian solo textos, mismos sids.
const MUSEUM_STICKERS = [
  { code: 'FWC9',  label: 'Italia 1934' },
  { code: 'FWC10', label: 'Uruguay 1950' },
  { code: 'FWC11', label: 'Alemania FR 1954' },
  { code: 'FWC12', label: 'Brasil 1962' },
  { code: 'FWC13', label: 'Alemania FR 1974' },
  { code: 'FWC14', label: 'Argentina 1986' },
  { code: 'FWC15', label: 'Brasil 1994' },
  { code: 'FWC16', label: 'Brasil 2002' },
  { code: 'FWC17', label: 'Italia 2006' },
  { code: 'FWC18', label: 'Alemania 2014' },
  { code: 'FWC19', label: 'Argentina 2022' },
];

// 14 láminas de la Colección Coca-Cola (edición Latinoamérica), códigos CC1–CC14.
// OJO: los 14 nombres están confirmados; el orden exacto CC1..CC14 puede ajustarse.
const COCA_COLA_STICKERS = [
  { code: 'CC1',  label: 'Lamine Yamal (España)' },
  { code: 'CC2',  label: 'Joshua Kimmich (Alemania)' },
  { code: 'CC3',  label: 'Harry Kane (Inglaterra)' },
  { code: 'CC4',  label: 'Santiago Giménez (México)' },
  { code: 'CC5',  label: 'Joško Gvardiol (Croacia)' },
  { code: 'CC6',  label: 'Federico Valverde (Uruguay)' },
  { code: 'CC7',  label: 'Jefferson Lerma (Colombia)' },
  { code: 'CC8',  label: 'Enner Valencia (Ecuador)' },
  { code: 'CC9',  label: 'Gabriel Magalhães (Brasil)' },
  { code: 'CC10', label: 'Virgil van Dijk (Países Bajos)' },
  { code: 'CC11', label: 'Alphonso Davies (Canadá)' },
  { code: 'CC12', label: 'Emiliano Martínez (Argentina)' },
  { code: 'CC13', label: 'Raúl Jiménez (México)' },
  { code: 'CC14', label: 'Lautaro Martínez (Argentina)' },
];

// 48 equipos en el MISMO ORDEN del álbum físico Panini FIFA World Cup 2026,
// con la PÁGINA en que empieza cada selección. EDITABLE desde la app.
// Cada objeto: { group, name, code, page }
const TEAMS = [
  // Grupo A
  { group: 'A', name: 'México', code: 'MEX', page: 8 },
  { group: 'A', name: 'Sudáfrica', code: 'RSA', page: 10 },
  { group: 'A', name: 'Corea del Sur', code: 'KOR', page: 12 },
  { group: 'A', name: 'Chequia', code: 'CZE', page: 14 },
  // Grupo B
  { group: 'B', name: 'Canadá', code: 'CAN', page: 16 },
  { group: 'B', name: 'Bosnia y Herzegovina', code: 'BIH', page: 18 },
  { group: 'B', name: 'Catar', code: 'QAT', page: 20 },
  { group: 'B', name: 'Suiza', code: 'SUI', page: 22 },
  // Grupo C
  { group: 'C', name: 'Brasil', code: 'BRA', page: 24 },
  { group: 'C', name: 'Marruecos', code: 'MAR', page: 26 },
  { group: 'C', name: 'Haití', code: 'HAI', page: 28 },
  { group: 'C', name: 'Escocia', code: 'SCO', page: 30 },
  // Grupo D
  { group: 'D', name: 'Estados Unidos', code: 'USA', page: 32 },
  { group: 'D', name: 'Paraguay', code: 'PAR', page: 34 },
  { group: 'D', name: 'Australia', code: 'AUS', page: 36 },
  { group: 'D', name: 'Turquía', code: 'TUR', page: 38 },
  // Grupo E
  { group: 'E', name: 'Alemania', code: 'GER', page: 40 },
  { group: 'E', name: 'Curazao', code: 'CUW', page: 42 },
  { group: 'E', name: 'Costa de Marfil', code: 'CIV', page: 44 },
  { group: 'E', name: 'Ecuador', code: 'ECU', page: 46 },
  // Grupo F
  { group: 'F', name: 'Países Bajos', code: 'NED', page: 48 },
  { group: 'F', name: 'Japón', code: 'JPN', page: 50 },
  { group: 'F', name: 'Suecia', code: 'SWE', page: 52 },
  { group: 'F', name: 'Túnez', code: 'TUN', page: 54 },
  // Grupo G
  { group: 'G', name: 'Bélgica', code: 'BEL', page: 58 },
  { group: 'G', name: 'Egipto', code: 'EGY', page: 60 },
  { group: 'G', name: 'Irán', code: 'IRN', page: 62 },
  { group: 'G', name: 'Nueva Zelanda', code: 'NZL', page: 64 },
  // Grupo H
  { group: 'H', name: 'España', code: 'ESP', page: 66 },
  { group: 'H', name: 'Cabo Verde', code: 'CPV', page: 68 },
  { group: 'H', name: 'Arabia Saudita', code: 'KSA', page: 70 },
  { group: 'H', name: 'Uruguay', code: 'URU', page: 72 },
  // Grupo I
  { group: 'I', name: 'Francia', code: 'FRA', page: 74 },
  { group: 'I', name: 'Senegal', code: 'SEN', page: 76 },
  { group: 'I', name: 'Irak', code: 'IRQ', page: 78 },
  { group: 'I', name: 'Noruega', code: 'NOR', page: 80 },
  // Grupo J
  { group: 'J', name: 'Argentina', code: 'ARG', page: 82 },
  { group: 'J', name: 'Argelia', code: 'ALG', page: 84 },
  { group: 'J', name: 'Austria', code: 'AUT', page: 86 },
  { group: 'J', name: 'Jordania', code: 'JOR', page: 88 },
  // Grupo K
  { group: 'K', name: 'Portugal', code: 'POR', page: 90 },
  { group: 'K', name: 'RD Congo', code: 'COD', page: 92 },
  { group: 'K', name: 'Uzbekistán', code: 'UZB', page: 94 },
  { group: 'K', name: 'Colombia', code: 'COL', page: 96 },
  // Grupo L
  { group: 'L', name: 'Inglaterra', code: 'ENG', page: 98 },
  { group: 'L', name: 'Croacia', code: 'CRO', page: 100 },
  { group: 'L', name: 'Ghana', code: 'GHA', page: 102 },
  { group: 'L', name: 'Panamá', code: 'PAN', page: 104 },
];

const STICKERS_PER_TEAM = 20;

// Mapa código FIFA (3 letras) -> código ISO 3166-1 alpha-2 (2 letras).
// Se usa para construir el emoji de bandera de cada país.
const FIFA_TO_ISO2 = {
  MEX: 'MX', RSA: 'ZA', KOR: 'KR', CZE: 'CZ',
  CAN: 'CA', SUI: 'CH', QAT: 'QA', BIH: 'BA',
  BRA: 'BR', MAR: 'MA', HAI: 'HT',
  USA: 'US', PAR: 'PY', AUS: 'AU', TUR: 'TR',
  ARG: 'AR', ALG: 'DZ', AUT: 'AT', JOR: 'JO',
  NED: 'NL', JPN: 'JP', TUN: 'TN', NZL: 'NZ',
  BEL: 'BE', EGY: 'EG', IRN: 'IR', CRC: 'CR',
  ESP: 'ES', URU: 'UY', KSA: 'SA', CPV: 'CV',
  FRA: 'FR', SEN: 'SN', NOR: 'NO', IRQ: 'IQ',
  GER: 'DE', COL: 'CO', CIV: 'CI', PAN: 'PA',
  POR: 'PT', COD: 'CD', UZB: 'UZ', ECU: 'EC',
  CRO: 'HR', GHA: 'GH', NGA: 'NG',
  CUW: 'CW', SWE: 'SE',
};

// Nombres en inglés (como aparecen en el álbum) por código, para que la
// búsqueda encuentre el equipo aunque escribas "Algeria" en vez de "Argelia".
// Se incluyen variantes comunes separadas por espacio.
const EN_NAMES = {
  MEX: 'Mexico', RSA: 'South Africa', KOR: 'Korea Republic', CZE: 'Czechia Czech',
  CAN: 'Canada', BIH: 'Bosnia Herzegovina', QAT: 'Qatar', SUI: 'Switzerland',
  BRA: 'Brazil', MAR: 'Morocco', HAI: 'Haiti', SCO: 'Scotland',
  USA: 'USA United States', PAR: 'Paraguay', AUS: 'Australia', TUR: 'Turkiye Turkey',
  GER: 'Germany', CUW: 'Curacao', CIV: "Cote d'Ivoire Ivory Coast", ECU: 'Ecuador',
  NED: 'Netherlands Holland', JPN: 'Japan', SWE: 'Sweden', TUN: 'Tunisia',
  BEL: 'Belgium', EGY: 'Egypt', IRN: 'Iran', NZL: 'New Zealand',
  ESP: 'Spain', CPV: 'Cabo Verde Cape Verde', KSA: 'Saudi Arabia', URU: 'Uruguay',
  FRA: 'France', SEN: 'Senegal', IRQ: 'Iraq', NOR: 'Norway',
  ARG: 'Argentina', ALG: 'Algeria', AUT: 'Austria', JOR: 'Jordan',
  POR: 'Portugal', COD: 'Congo DR DR Congo', UZB: 'Uzbekistan', COL: 'Colombia',
  ENG: 'England', CRO: 'Croatia', GHA: 'Ghana', PAN: 'Panama',
};

// Banderas de subdivisiones del Reino Unido (no tienen código ISO alpha-2).
const SPECIAL_FLAGS = {
  SCO: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', // 🏴 Escocia
  ENG: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', // 🏴 Inglaterra
};

/**
 * Devuelve el emoji de bandera para un código de equipo (FIFA o ISO2).
 * Si no se reconoce el código, devuelve cadena vacía.
 */
function flagFor(code) {
  if (!code) return '';
  const c = String(code).toUpperCase();
  if (SPECIAL_FLAGS[c]) return SPECIAL_FLAGS[c];
  const iso2 = FIFA_TO_ISO2[c] || (c.length === 2 ? c : '');
  if (iso2.length !== 2 || !/^[A-Z]{2}$/.test(iso2)) return '';
  const A = 0x1F1E6; // 🇦 (regional indicator A)
  return String.fromCodePoint(A + (iso2.charCodeAt(0) - 65)) +
         String.fromCodePoint(A + (iso2.charCodeAt(1) - 65));
}

/**
 * Construye la lista completa de secciones y láminas a partir de la
 * configuración (que puede venir editada desde localStorage).
 * Devuelve { sections: [...], stickers: [...] } con numeración recalculada.
 *
 * Cada sticker: { num, key, label, sectionId, sectionTitle }
 *   - num: número global 1..980
 *   - key: identificador estable para guardar el estado (no cambia al renombrar)
 */
function buildAlbum(teams) {
  const sections = [];
  const stickers = [];
  let num = 1;

  // Secciones especiales (no-equipo). Cada entrada es { code, label }; el sid
  // estable es <PREFIX>-<n> POSICIONAL (no cambia al renombrar). `disp` sigue
  // siendo numérico (1..N) para ordenar/comprimir rangos; lo que se MUESTRA es
  // `code` (FW0, FWC1, CC1…).
  function addSpecial(id, title, prefix, entries) {
    const sec = { id, title, kind: 'special', stickers: [] };
    entries.forEach((e, i) => {
      const s = {
        num: num++, disp: i + 1, code: e.code,
        key: `${id}-${i}`, sid: `${prefix}-${i + 1}`,
        label: e.label, sectionId: id, sectionTitle: title,
        aka: (e.code || '').toLowerCase(),
      };
      sec.stickers.push(s);
      stickers.push(s);
    });
    sections.push(sec);
  }
  addSpecial('intro',  'Introducción',            'INTRO',  INTRO_STICKERS);
  addSpecial('museum', 'FIFA Museum (Leyendas)',  'MUSEUM', MUSEUM_STICKERS);
  addSpecial('coca',   'Colección Coca-Cola',     'COCA',   COCA_COLA_STICKERS);

  // Secciones por equipo
  teams.forEach((team, ti) => {
    const sectionId = `team-${ti}`;
    const title = `Grupo ${team.group} · ${team.name}`;
    const section = {
      id: sectionId,
      title,
      group: team.group,
      teamName: team.name,
      code: team.code,
      page: team.page,
      kind: 'team',
      teamIndex: ti,
      stickers: [],
    };
    for (let slot = 1; slot <= STICKERS_PER_TEAM; slot++) {
      // Numeración POR EQUIPO: cada equipo va del 1 al 20.
      // (escudo = 1, foto del plantel = 13, el resto jugadores)
      let label;
      if (slot === 1) label = 'Escudo ✨';
      else if (slot === 13) label = 'Foto plantel';
      else label = 'Jugador';
      const s = {
        num: num++,           // número global 1..980 (para orden/respaldos)
        disp: slot,           // número que se MUESTRA (1..20 por equipo)
        key: `${sectionId}-${slot}`,
        sid: `${team.code}-${slot}`,   // id estable para sincronizar entre usuarios
        label,
        sectionId,
        sectionTitle: title,
        // texto extra para búsqueda: código + nombre en inglés (no se muestra)
        aka: `${team.code || ''} ${EN_NAMES[team.code] || ''}`.toLowerCase(),
      };
      section.stickers.push(s);
      stickers.push(s);
    }
    sections.push(section);
  });

  return { sections, stickers };
}

window.ALBUM_CONFIG = {
  INTRO_STICKERS,
  MUSEUM_STICKERS,
  COCA_COLA_STICKERS,
  DEFAULT_TEAMS: TEAMS,
  STICKERS_PER_TEAM,
  buildAlbum,
  flagFor,
  TOTAL: INTRO_STICKERS.length + MUSEUM_STICKERS.length + COCA_COLA_STICKERS.length + TEAMS.length * STICKERS_PER_TEAM,
};
