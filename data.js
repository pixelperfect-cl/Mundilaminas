/*
 * Álbum Panini FIFA World Cup 2026 — estructura de la colección.
 *
 * Total: 980 láminas
 *   - 9  láminas de Introducción (foil/brillantes)
 *   - 11 láminas FIFA Museum (leyendas / campeones del pasado)
 *   - 48 equipos × 20 láminas = 960
 *
 * Los 48 equipos y sus grupos (A-L) corresponden al SORTEO FINAL OFICIAL
 * del Mundial 2026 (Washington D.C., 5 dic 2025), con los repechajes ya
 * resueltos. Igual puedes editar cualquier equipo desde la app (botón ✏️)
 * para que calce exactamente con tu álbum físico. La numeración se recalcula sola.
 *
 * Numeración usada:
 *   Intro:        1 – 9
 *   FIFA Museum: 10 – 20
 *   Equipos:     21 – 980  (cada equipo ocupa 20 números consecutivos)
 *
 * Dentro de cada equipo (20 láminas):
 *   slot 1  -> Escudo (brillante)
 *   slot 2  -> Foto del plantel
 *   slot 3..20 -> Jugadores (18)
 */

// 9 láminas de introducción (brillantes)
const INTRO_STICKERS = [
  'Logo Panini',
  'Emblema oficial',
  'Mascota La\'eeb / Trío',
  'Mascotas',
  'Eslogan oficial',
  'Balón oficial',
  'Sede: Estados Unidos',
  'Sede: México',
  'Sede: Canadá',
];

// 11 láminas FIFA Museum (campeones históricos)
const MUSEUM_STICKERS = [
  'FIFA Museum 1',
  'FIFA Museum 2',
  'FIFA Museum 3',
  'FIFA Museum 4',
  'FIFA Museum 5',
  'FIFA Museum 6',
  'FIFA Museum 7',
  'FIFA Museum 8',
  'FIFA Museum 9',
  'FIFA Museum 10',
  'FIFA Museum 11',
];

// 48 equipos agrupados por grupo (A-L) según el SORTEO FINAL OFICIAL
// (Washington D.C., 5 dic 2025) con los repechajes ya resueltos.
// EDITABLE desde la app. Cada objeto: { group: 'A', name: 'México', code: 'MEX' }
// Orden dentro de cada grupo: por bombo (cabeza de serie primero).
const TEAMS = [
  // Grupo A
  { group: 'A', name: 'México', code: 'MEX' },
  { group: 'A', name: 'Corea del Sur', code: 'KOR' },
  { group: 'A', name: 'Sudáfrica', code: 'RSA' },
  { group: 'A', name: 'Chequia', code: 'CZE' },
  // Grupo B
  { group: 'B', name: 'Canadá', code: 'CAN' },
  { group: 'B', name: 'Suiza', code: 'SUI' },
  { group: 'B', name: 'Catar', code: 'QAT' },
  { group: 'B', name: 'Bosnia y Herzegovina', code: 'BIH' },
  // Grupo C
  { group: 'C', name: 'Brasil', code: 'BRA' },
  { group: 'C', name: 'Marruecos', code: 'MAR' },
  { group: 'C', name: 'Escocia', code: 'SCO' },
  { group: 'C', name: 'Haití', code: 'HAI' },
  // Grupo D
  { group: 'D', name: 'Estados Unidos', code: 'USA' },
  { group: 'D', name: 'Australia', code: 'AUS' },
  { group: 'D', name: 'Paraguay', code: 'PAR' },
  { group: 'D', name: 'Turquía', code: 'TUR' },
  // Grupo E
  { group: 'E', name: 'Alemania', code: 'GER' },
  { group: 'E', name: 'Ecuador', code: 'ECU' },
  { group: 'E', name: 'Costa de Marfil', code: 'CIV' },
  { group: 'E', name: 'Curazao', code: 'CUW' },
  // Grupo F
  { group: 'F', name: 'Países Bajos', code: 'NED' },
  { group: 'F', name: 'Japón', code: 'JPN' },
  { group: 'F', name: 'Túnez', code: 'TUN' },
  { group: 'F', name: 'Suecia', code: 'SWE' },
  // Grupo G
  { group: 'G', name: 'Bélgica', code: 'BEL' },
  { group: 'G', name: 'Irán', code: 'IRN' },
  { group: 'G', name: 'Egipto', code: 'EGY' },
  { group: 'G', name: 'Nueva Zelanda', code: 'NZL' },
  // Grupo H
  { group: 'H', name: 'España', code: 'ESP' },
  { group: 'H', name: 'Uruguay', code: 'URU' },
  { group: 'H', name: 'Arabia Saudita', code: 'KSA' },
  { group: 'H', name: 'Cabo Verde', code: 'CPV' },
  // Grupo I
  { group: 'I', name: 'Francia', code: 'FRA' },
  { group: 'I', name: 'Senegal', code: 'SEN' },
  { group: 'I', name: 'Noruega', code: 'NOR' },
  { group: 'I', name: 'Irak', code: 'IRQ' },
  // Grupo J
  { group: 'J', name: 'Argentina', code: 'ARG' },
  { group: 'J', name: 'Austria', code: 'AUT' },
  { group: 'J', name: 'Argelia', code: 'ALG' },
  { group: 'J', name: 'Jordania', code: 'JOR' },
  // Grupo K
  { group: 'K', name: 'Portugal', code: 'POR' },
  { group: 'K', name: 'Colombia', code: 'COL' },
  { group: 'K', name: 'Uzbekistán', code: 'UZB' },
  { group: 'K', name: 'RD Congo', code: 'COD' },
  // Grupo L
  { group: 'L', name: 'Inglaterra', code: 'ENG' },
  { group: 'L', name: 'Croacia', code: 'CRO' },
  { group: 'L', name: 'Panamá', code: 'PAN' },
  { group: 'L', name: 'Ghana', code: 'GHA' },
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

  // Sección Introducción
  const intro = { id: 'intro', title: 'Introducción', kind: 'special', stickers: [] };
  INTRO_STICKERS.forEach((label, i) => {
    const s = { num: num++, disp: i + 1, key: `intro-${i}`, label, sectionId: 'intro', sectionTitle: 'Introducción' };
    intro.stickers.push(s);
    stickers.push(s);
  });
  sections.push(intro);

  // Sección FIFA Museum
  const museum = { id: 'museum', title: 'FIFA Museum (Leyendas)', kind: 'special', stickers: [] };
  MUSEUM_STICKERS.forEach((label, i) => {
    const s = { num: num++, disp: i + 1, key: `museum-${i}`, label, sectionId: 'museum', sectionTitle: 'FIFA Museum' };
    museum.stickers.push(s);
    stickers.push(s);
  });
  sections.push(museum);

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
        label,
        sectionId,
        sectionTitle: title,
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
  DEFAULT_TEAMS: TEAMS,
  STICKERS_PER_TEAM,
  buildAlbum,
  flagFor,
  TOTAL: INTRO_STICKERS.length + MUSEUM_STICKERS.length + TEAMS.length * STICKERS_PER_TEAM,
};
