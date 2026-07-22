/* Mundial 2026 · Mis Láminas — lógica de la app (vanilla JS, localStorage) */
(function () {
  'use strict';

  const CFG = window.ALBUM_CONFIG;
  const LS_COUNTS = 'wc26-counts';
  const LS_TEAMS = 'wc26-teams';
  const LS_OPEN = 'wc26-open-sections';
  const LS_TOKEN = 'wc26-token';
  const LS_USER = 'wc26-user';
  const LS_DIRTY = 'wc26-dirty';
  const LS_API = 'wc26-api';
  const LS_GID = 'wc26-gid';
  const LS_COUNTS_OWNER = 'wc26-counts-owner';  // dueño de la colección local (evita fuga entre cuentas)
  const LS_DISCLAIMER = 'wc26-disclaimer-ack';  // ya vio el aviso "app no oficial" (primer arranque)

  // Configuración de la nube. Por defecto la API vive en el MISMO origen que
  // la app (mismo dominio/cert) — ver apiBase(). Así funciona en cualquier
  // dominio (mundilaminas.cl, el temporal de Cloudways, etc.) sin CORS ni URLs
  // hardcodeadas. Igual se puede forzar otra URL desde el menú (localStorage).
  const DEFAULT_API_BASE = '';
  const DEFAULT_CLIENT_ID = '598312536196-siqndl4beehru3lnvp6vlqica4ufc27m.apps.googleusercontent.com';
  // Clave pública VAPID para Web Push (la privada vive solo en el server).
  const PUSH_VAPID_PUBLIC = 'BAVsswPfELLnzsdNvZgX3P5T0FCHcJ03FNNRDOR6Eqzl5m8huHpJrfZv1Goo18pcYn0GUzZhgFqkcW-W32RdocI';

  // ---------- Estado ----------
  let counts = loadJSON(LS_COUNTS, {});            // { stickerKey: copiasQueTengo }
  let teams = loadJSON(LS_TEAMS, null) || clone(CFG.DEFAULT_TEAMS);
  let openSections = new Set(loadJSON(LS_OPEN, []));
  // Colapso manual en vistas filtradas (Me faltan/Repetidas), que van expandidas
  // por defecto. Transitorio: se reinicia cada sesión (no se persiste).
  let collapsedFilterSections = new Set();
  let filter = 'all';      // all | missing | repe
  let search = '';
  let album = CFG.buildAlbum(teams);

  // ---------- Helpers de almacenamiento ----------
  function loadJSON(k, fallback) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function getCount(key) {
    return counts[key] || 0;
  }
  function setCount(key, n) {
    n = Math.max(0, n | 0);
    if (n === 0) delete counts[key]; else counts[key] = n;
    saveJSON(LS_COUNTS, counts);
    markDirty(key);   // para sincronizar con la nube si hay sesión
  }

  // ---------- Mapas key <-> sid (para sincronizar) ----------
  let keyToSid = {}, sidToKey = {};
  function rebuildSidMaps() {
    keyToSid = {}; sidToKey = {};
    album.stickers.forEach((s) => {
      if (!s.sid) return;
      keyToSid[s.key] = s.sid;
      sidToKey[s.sid] = s.key;
    });
  }
  function stickerBySid(sid) { return album.stickers.find((s) => s.sid === sid) || null; }
  // Mapa { sid: qty } de la colección personal, para sincronizar con la nube.
  function countsBySid() {
    const out = {};
    album.stickers.forEach((s) => { const c = counts[s.key] || 0; if (c > 0 && s.sid) out[s.sid] = c; });
    return out;
  }

  // ---------- Cálculos ----------
  function stats() {
    let have = 0, missing = 0, repesTotal = 0;
    album.stickers.forEach((s) => {
      const c = getCount(s.key);
      if (c >= 1) have++; else missing++;
      if (c >= 2) repesTotal += c - 1;
    });
    return { total: album.stickers.length, have, missing, repesTotal };
  }

  function sectionStats(section) {
    let have = 0;
    section.stickers.forEach((s) => { if (getCount(s.key) >= 1) have++; });
    return { have, total: section.stickers.length };
  }

  // ---------- Render ----------
  const el = (id) => document.getElementById(id);

  function render() {
    renderProgress();
    renderSections();
    if (currentView === 'home') renderDashboard();
  }

  function renderProgress() {
    const st = stats();
    const pct = st.total ? Math.round((st.have / st.total) * 100) : 0;
    el('progressFill').style.width = pct + '%';
    el('progressText').textContent = `${st.have} / ${st.total} láminas`;
    el('progressPct').textContent = `${pct}% · faltan ${st.missing} · repes ${st.repesTotal}`;
  }

  function matchesFilter(s) {
    const c = getCount(s.key);
    if (filter === 'missing' && c >= 1) return false;
    if (filter === 'repe' && c < 2) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!String(s.disp).includes(q) && !(s.code || '').toLowerCase().includes(q) &&
          !s.label.toLowerCase().includes(q) &&
          !s.sectionTitle.toLowerCase().includes(q) &&
          !(s.aka || '').includes(q)) return false;
    }
    return true;
  }

  function renderSections() {
    const root = el('sections');
    root.innerHTML = '';
    let anyVisible = false;

    album.sections.forEach((section) => {
      const visible = section.stickers.filter(matchesFilter);
      if (visible.length === 0) return;
      anyVisible = true;

      const ss = sectionStats(section);
      const secPct = ss.total ? Math.round((ss.have / ss.total) * 100) : 0;
      // "Todas": estado persistente (por defecto colapsado). Vistas filtradas
      // (Me faltan/Repetidas): expandidas por defecto pero colapsables. Búsqueda: todo abierto.
      const isOpen = search ? true
        : (filter !== 'all') ? !collapsedFilterSections.has(section.id)
        : openSections.has(section.id);

      const secEl = document.createElement('div');
      secEl.className = 'section' + (isOpen ? ' open' : '');

      const teamFlag = (CFG.flagFor && CFG.flagFor(section.code)) || '';
      const flag = section.kind === 'team'
        ? `${teamFlag ? `<div class="flag-emoji">${teamFlag}</div>` : ''}<div class="flag">${section.code || ''}</div>`
        : `<div class="flag">★</div>`;

      const head = document.createElement('div');
      head.className = 'section-head';
      head.innerHTML = `
        <span class="chev">▶</span>
        ${flag}
        <div class="section-title">
          <div class="name">${escapeHtml(section.kind === 'team' ? section.teamName : section.title)}</div>
          <div class="meta">${section.kind === 'team' ? 'Grupo ' + section.group + (section.page ? ' · pág. ' + section.page : '') : section.title}</div>
        </div>
        <div class="section-mini ${ss.have === ss.total ? 'done' : ''}">${ss.have}/${ss.total}</div>
        <div class="sec-progress ${ss.have === ss.total ? 'done' : ''}" aria-hidden="true"><i style="width:${secPct}%"></i></div>
      `;
      head.addEventListener('click', () => {
        if (search) return;   // buscando: todo abierto para ver los resultados
        if (filter !== 'all') {   // vistas filtradas: colapso transitorio
          if (collapsedFilterSections.has(section.id)) collapsedFilterSections.delete(section.id);
          else collapsedFilterSections.add(section.id);
        } else {   // "Todas": estado persistente
          if (openSections.has(section.id)) openSections.delete(section.id);
          else openSections.add(section.id);
          saveJSON(LS_OPEN, [...openSections]);
        }
        renderSections();
      });
      secEl.appendChild(head);

      const miniEl = head.querySelector('.section-mini');
      if (isOpen) {
        const grid = document.createElement('div');
        grid.className = 'sticker-grid';
        visible.forEach((s) => grid.appendChild(stickerEl(s, section, miniEl)));
        secEl.appendChild(grid);
      }
      root.appendChild(secEl);
    });

    if (!anyVisible) {
      root.innerHTML = `<div class="empty">No hay láminas que coincidan con el filtro.</div>`;
    }
  }

  function stickerEl(s, section, miniEl) {
    const c = getCount(s.key);
    const div = document.createElement('div');
    div.className = 'sticker' + (c >= 2 ? ' repe' : c === 1 ? ' have' : '');
    const repes = c >= 2 ? c - 1 : 0;
    div.innerHTML = `
      ${repes > 0 ? `<span class="badge-repe">+${repes}</span>` : ''}
      <div class="num">${escapeHtml(s.code || ('#' + s.disp))}</div>
      <div class="lbl">${escapeHtml(s.label)}</div>
      <div class="ctrl">
        <button class="minus" aria-label="quitar">−</button>
        <span class="cnt">${c === 0 ? '·' : c}</span>
        <button class="plus" aria-label="sumar">+</button>
      </div>
    `;
    const cntEl = div.querySelector('.cnt');
    const apply = (n) => {
      setCount(s.key, n);
      const nc = getCount(s.key);
      cntEl.textContent = nc === 0 ? '·' : nc;
      div.className = 'sticker' + (nc >= 2 ? ' repe' : nc === 1 ? ' have' : '');
      const old = div.querySelector('.badge-repe'); if (old) old.remove();
      if (nc >= 2) {
        const b = document.createElement('span'); b.className = 'badge-repe';
        b.textContent = '+' + (nc - 1); div.prepend(b);
      }
      renderProgress();
      // actualizar contador de la sección en vivo
      if (miniEl && section) {
        const ss = sectionStats(section);
        miniEl.textContent = `${ss.have}/${ss.total}`;
        const done = ss.have === ss.total;
        miniEl.classList.toggle('done', done);
        const bar = miniEl.parentElement && miniEl.parentElement.querySelector('.sec-progress');
        if (bar) {
          bar.classList.toggle('done', done);
          const fill = bar.querySelector('i');
          if (fill) fill.style.width = (ss.total ? Math.round((ss.have / ss.total) * 100) : 0) + '%';
        }
      }
      // si hay filtro activo y deja de calzar, re-render para ocultarla
      if (filter !== 'all' && !matchesFilter(s)) renderSections();
    };
    // siempre re-leemos getCount(s.key) por si el cierre quedó desactualizado
    div.querySelector('.plus').addEventListener('click', (e) => { e.stopPropagation(); apply(getCount(s.key) + 1); });
    div.querySelector('.minus').addEventListener('click', (e) => { e.stopPropagation(); apply(getCount(s.key) - 1); });
    return div;
  }

  // ---------- Listas (faltan / repes) ----------
  // Título de una sección para las listas, con bandera del país si es equipo.
  function sectionLabel(section) {
    if (section.kind !== 'team') return section.title;
    const flag = CFG.flagFor ? CFG.flagFor(section.code) : '';
    const pg = section.page ? ` (pág. ${section.page})` : '';
    return `${flag ? flag + ' ' : ''}Grupo ${section.group} · ${section.teamName}${pg}`;
  }

  // Cómo se muestra/comparte una lámina: código impreso (FWC1, CC3…) o "#num".
  function stickerCode(s) { return s.code || ('#' + s.disp); }
  // Lista de especiales ordenada por su número interno, mostrando el código.
  function codeList(items) {
    return [...items].sort((a, b) => a.disp - b.disp).map(stickerCode).join(', ');
  }

  // Comprime números consecutivos en rangos: [1,2,3,5,8,9] -> "#1-3, #5, #8-9".
  function rangeStr(nums) {
    const sorted = [...nums].map(Number).filter((n) => !isNaN(n)).sort((a, b) => a - b);
    const parts = [];
    let i = 0;
    while (i < sorted.length) {
      let j = i;
      while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
      parts.push(j > i ? `#${sorted[i]}-${sorted[j]}` : `#${sorted[i]}`);
      i = j + 1;
    }
    return parts.join(', ');
  }

  // Arma el texto para compartir: título, total, especiales y equipos agrupados
  // por Grupo, con rangos compactos. collect(section) -> { count, body } | null
  function buildShareText({ title, totalLine, emptyMsg, collect }) {
    const groups = [];
    let curGroup = null, total = 0;
    const specials = [];
    album.sections.forEach((section) => {
      const r = collect(section);
      if (!r) return;
      total += r.count;
      if (section.kind === 'team') {
        const flag = CFG.flagFor ? (CFG.flagFor(section.code) || '') : '';
        const pg = section.page ? ` (pág. ${section.page})` : '';
        const line = `${flag ? flag + ' ' : ''}${section.teamName}${pg}: ${r.body}`;
        if (!curGroup || curGroup.group !== section.group) {
          curGroup = { group: section.group, lines: [] };
          groups.push(curGroup);
        }
        curGroup.lines.push(line);
      } else {
        specials.push(`${section.title}: ${r.body}`);
      }
    });
    if (total === 0) return emptyMsg;
    const out = [title, totalLine(total)];
    if (specials.length) out.push('', '⭐ Especiales', ...specials);
    groups.forEach((g) => out.push('', `— Grupo ${g.group} —`, ...g.lines));
    out.push('', '— Mundial 2026 · Mis Láminas');
    return out.join('\n');
  }

  function buildMissingText() {
    return buildShareText({
      title: '🟥 ME FALTAN · Mundial 2026',
      totalLine: (t) => `Me faltan ${t} lámina${t !== 1 ? 's' : ''}`,
      emptyMsg: '🎉 ¡No me falta ninguna! Álbum completo.',
      collect: (section) => {
        const miss = section.stickers.filter((s) => getCount(s.key) === 0);
        if (!miss.length) return null;
        const body = section.kind === 'team' ? rangeStr(miss.map((s) => s.disp)) : codeList(miss);
        const all = miss.length === section.stickers.length;
        return { count: miss.length, body: all ? `todas (${body})` : body };
      },
    });
  }

  function buildRepesText() {
    // Comprime repes consecutivas de la misma cantidad: "#5-7" o "#5-7 (x2)".
    const repeStr = (items) => {
      const sorted = [...items].sort((a, b) => a.disp - b.disp);
      const parts = [];
      let i = 0;
      while (i < sorted.length) {
        let j = i;
        while (j + 1 < sorted.length && sorted[j + 1].disp === sorted[j].disp + 1 && sorted[j + 1].extra === sorted[i].extra) j++;
        const tag = sorted[i].extra > 1 ? ` (x${sorted[i].extra})` : '';
        parts.push(j > i ? `#${sorted[i].disp}-${sorted[j].disp}${tag}` : `#${sorted[i].disp}${tag}`);
        i = j + 1;
      }
      return parts.join(', ');
    };
    return buildShareText({
      title: '🔁 REPETIDAS para cambiar · Mundial 2026',
      totalLine: (t) => `Tengo ${t} repetida${t !== 1 ? 's' : ''} para cambiar`,
      emptyMsg: 'Aún no tengo repetidas para cambiar.',
      collect: (section) => {
        const reps = section.stickers
          .map((s) => ({ s, disp: Number(s.disp), extra: Math.max(0, getCount(s.key) - 1) }))
          .filter((x) => x.extra > 0);
        if (!reps.length) return null;
        const count = reps.reduce((a, x) => a + x.extra, 0);
        const body = section.kind === 'team'
          ? repeStr(reps)
          : [...reps].sort((a, b) => a.disp - b.disp)
              .map((x) => `${stickerCode(x.s)}${x.extra > 1 ? ` (x${x.extra})` : ''}`).join(', ');
        return { count, body };
      },
    });
  }

  // ---------- Modales ----------
  let listsTab = 'missing';
  function openLists() {
    listsTab = 'missing';
    el('modalLists').classList.add('open');
    refreshListsModal();
  }
  function refreshListsModal() {
    el('tabMissing').classList.toggle('active', listsTab === 'missing');
    el('tabRepes').classList.toggle('active', listsTab === 'repes');
    const text = listsTab === 'missing' ? buildMissingText() : buildRepesText();
    el('listOutput').textContent = text;
    el('listOutput').dataset.text = text;
  }

  function openMenu() {
    const st = stats();
    el('statHave').textContent = st.have;
    el('statMissing').textContent = st.missing;
    el('statRepes').textContent = st.repesTotal;
    renderTeamEditor();
    updateCloudUI();
    el('modalMenu').classList.add('open');
  }

  function openAbout() {
    closeModals();
    el('modalAbout').classList.add('open');
  }

  function renderTeamEditor() {
    const wrap = el('teamEditor');
    wrap.innerHTML = '';
    teams.forEach((t, i) => {
      const row = document.createElement('div');
      row.className = 'team-edit-row';
      row.innerHTML = `
        <input class="grp" value="${escapeHtml(t.group)}" maxlength="2" data-i="${i}" data-f="group" />
        <input class="nm" value="${escapeHtml(t.name)}" data-i="${i}" data-f="name" />
        <input class="grp" value="${escapeHtml(t.code || '')}" maxlength="3" data-i="${i}" data-f="code" />
      `;
      wrap.appendChild(row);
    });
    wrap.querySelectorAll('input').forEach((inp) => {
      inp.addEventListener('change', (e) => {
        const i = +e.target.dataset.i, f = e.target.dataset.f;
        teams[i][f] = e.target.value;
      });
    });
  }

  function saveTeams() {
    saveJSON(LS_TEAMS, teams);
    album = CFG.buildAlbum(teams);   // re-numera, mantiene counts por key estable
    rebuildSidMaps();
    render();
    closeModals();
    toast('Equipos guardados ✓');
  }

  async function resetTeams() {
    if (!(await confirmDialog('¿Restaurar los 48 equipos por defecto? No borra tus láminas marcadas.', { ok: 'Restaurar' }))) return;
    teams = clone(CFG.DEFAULT_TEAMS);
    saveJSON(LS_TEAMS, teams);
    album = CFG.buildAlbum(teams);
    rebuildSidMaps();
    renderTeamEditor();
    render();
    toast('Equipos restaurados');
  }

  // ---------- Export / Import ----------
  function exportData() {
    const payload = { v: 1, app: 'wc26-album', exportedAt: new Date().toISOString(), counts, teams };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'mundial2026-laminas-backup.json';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast('Respaldo descargado ✓');
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.counts) counts = data.counts;
        if (Array.isArray(data.teams) && data.teams.length) teams = data.teams;
        saveJSON(LS_COUNTS, counts);
        saveJSON(LS_TEAMS, teams);
        album = CFG.buildAlbum(teams);
        rebuildSidMaps();
        render();
        closeModals();
        toast('Respaldo importado ✓');
        if (loggedIn() && cloudConfigured()) {   // subir lo importado a la nube
          dirty = new Set(Object.keys(countsBySid()));
          saveJSON(LS_DIRTY, [...dirty]);
          flushDirty();
        }
      } catch {
        toast('No se pudo leer el archivo. ¿Es un respaldo válido?');
      }
    };
    reader.readAsText(file);
  }

  async function resetAll() {
    if (!(await confirmDialog('¿Borrar las láminas marcadas y los equipos de ESTE dispositivo? Si tienes sesión, tu colección en la nube no se borra desde aquí.', { ok: 'Borrar', danger: true }))) return;
    counts = {}; teams = clone(CFG.DEFAULT_TEAMS); openSections = new Set();
    dirty = new Set(); saveJSON(LS_DIRTY, []);
    localStorage.removeItem(LS_COUNTS);
    localStorage.removeItem(LS_TEAMS);
    localStorage.removeItem(LS_OPEN);
    album = CFG.buildAlbum(teams);
    rebuildSidMaps();
    render(); closeModals(); toast('Datos locales borrados');
  }

  // ---------- Compartir / copiar ----------
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => toast('Copiado ✓'), () => fallbackCopy(text));
    } else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Copiado ✓'); } catch { toast('No se pudo copiar'); }
    ta.remove();
  }
  function shareText(text) {
    if (navigator.share) navigator.share({ title: 'Mundial 2026 · Láminas', text }).catch(() => {});
    else { copyText(text); toast('Copiado (no hay share nativo)'); }
  }
  // Abre WhatsApp con el texto ya cargado para elegir el contacto/grupo.
  function shareWhatsApp(text) {
    if (!text) return;
    const url = 'https://wa.me/?text=' + encodeURIComponent(text);
    window.open(url, '_blank');
  }

  // ---------- Utilidades UI ----------
  function closeModals() {
    document.querySelectorAll('.modal-back').forEach((m) => m.classList.remove('open'));
  }
  let toastTimer;
  function toast(msg) {
    const t = el('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  // ===================================================================
  // ==========   NUBE: cuenta Google + sincronización + amigos   ======
  // ===================================================================
  let authToken = localStorage.getItem(LS_TOKEN) || '';
  let me = loadJSON(LS_USER, null);
  let dirty = new Set(loadJSON(LS_DIRTY, []));
  let flushTimer = null, googleReady = false;

  // Vista activa (Inicio/dashboard vs Álbum/grilla) y cache de amigos para el dashboard.
  let currentView = 'home';
  let lastFriends = { friends: [], incoming: [] };

  function apiBase() {
    let b = (localStorage.getItem(LS_API) || DEFAULT_API_BASE || '').replace(/\/+$/, '');
    // Same-origin por defecto + auto-reparación: si está vacío o quedó apuntando
    // al dominio temporal viejo de Cloudways (cuyo cert quedó inválido al conectar
    // el dominio propio), usar el origen actual — siempre tiene cert válido y sin CORS.
    if (!b || /\.cloudwaysapps\.com/i.test(b)) b = window.location.origin;
    return b;
  }
  function clientId() { return localStorage.getItem(LS_GID) || DEFAULT_CLIENT_ID || ''; }
  function cloudConfigured() { return !!apiBase(); }
  function loggedIn() { return !!authToken && !!me; }

  function markDirty(key) {
    const sid = keyToSid[key];
    if (!sid) return;
    dirty.add(sid);
    saveJSON(LS_DIRTY, [...dirty]);
    if (loggedIn() && cloudConfigured()) scheduleFlush();
  }
  function scheduleFlush() { clearTimeout(flushTimer); flushTimer = setTimeout(flushDirty, 1200); }

  async function api(path, { method = 'GET', body = null, auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && authToken) headers['Authorization'] = 'Bearer ' + authToken;
    const res = await fetch(apiBase() + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    let data = null; try { data = await res.json(); } catch {}
    if (!res.ok) {
      if (res.status === 401) clearSession();
      throw new Error((data && data.error) || ('Error ' + res.status));
    }
    return data;
  }

  async function flushDirty() {
    if (!loggedIn() || !cloudConfigured() || dirty.size === 0) return;
    const sending = [...dirty];
    const all = countsBySid(), payload = {};
    sending.forEach((sid) => { payload[sid] = all[sid] || 0; });
    dirty.clear(); saveJSON(LS_DIRTY, []);            // vaciar ANTES del await
    try { await api('/me/collection', { method: 'PUT', body: { counts: payload } }); }
    catch (e) { sending.forEach((sid) => dirty.add(sid)); saveJSON(LS_DIRTY, [...dirty]); }  // re-encolar
  }

  function setSession(token, user) { authToken = token; me = user; localStorage.setItem(LS_TOKEN, token); saveJSON(LS_USER, user); updateCloudUI(); }
  function clearSession() { authToken = ''; me = null; localStorage.removeItem(LS_TOKEN); localStorage.removeItem(LS_USER); updateCloudUI(); }

  // -- Google Identity Services --
  function initGoogle() {
    if (googleReady || !clientId() || !(window.google && google.accounts && google.accounts.id)) return;
    google.accounts.id.initialize({ client_id: clientId(), callback: onGoogleCredential });
    googleReady = true;
  }
  // Espera a que cargue el script de Google (async) y ejecuta cb. ~5s de margen.
  function whenGoogleReady(cb, tries = 120) {
    if (window.google && google.accounts && google.accounts.id) { cb(); return; }
    if (tries <= 0) { onGoogleLoadFailed(cb); return; }
    setTimeout(() => whenGoogleReady(cb, tries - 1), 100);
  }
  // Si el script de Google nunca carga, no dejar el gate atascado: ofrecer reintento.
  function onGoogleLoadFailed(cb) {
    const loading = el('gateLoading');
    if (!loading) return;
    loading.hidden = false;
    loading.innerHTML = 'No se pudo cargar el inicio de sesión de Google. Revisa tu conexión e <button id="gateRetry" class="mini-btn">intenta de nuevo</button>.';
    const rb = el('gateRetry');
    if (rb) rb.addEventListener('click', () => {
      loading.textContent = 'Cargando inicio de sesión…';
      whenGoogleReady(cb || (() => { initGoogle(); updateGate(); }));
    });
  }
  function renderGoogleButton(containerId, width) {
    const cont = el(containerId);
    if (!cont || !googleReady) return false;
    cont.innerHTML = '';
    google.accounts.id.renderButton(cont, { theme: 'filled_blue', size: 'large', text: 'signin_with', shape: 'pill', width: width || undefined });
    return true;
  }
  function promptGoogle() {
    if (!cloudConfigured()) { toast('Falta configurar la URL de la API'); return; }
    if (!clientId()) { toast('Falta el Client ID de Google'); return; }
    initGoogle();
    if (!googleReady) { toast('Google aún no carga, reintenta'); return; }
    renderGoogleButton('gbtn');
    google.accounts.id.prompt();
  }
  async function onGoogleCredential(resp) {
    try {
      const data = await api('/auth/google', { method: 'POST', auth: false, body: { id_token: resp.credential } });
      setSession(data.token, data.user);
      toast('Sesión iniciada ✓');
      await syncAfterLogin();
      renderFriends();
    } catch (e) { toast('No se pudo iniciar sesión'); }
  }
  function doLogout() {
    clearSession();
    stopNotifPolling();
    setBadge(0);
    render();
    if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect();
    toast('Sesión cerrada');
  }

  // Borra la cuenta y TODOS los datos del servidor (cascada), y limpia el
  // dispositivo. Cumple el requisito de "eliminación de cuenta" de Google Play.
  async function deleteAccount() {
    if (!loggedIn()) { toast('Inicia sesión primero'); return; }
    const ok = await confirmDialog(
      'Esto borra tu cuenta y TODOS tus datos del servidor: tu colección, tus amigos y tus avisos. No se puede deshacer. ¿Seguro?',
      { ok: 'Borrar mi cuenta', cancel: 'Cancelar', danger: true }
    );
    if (!ok) return;
    try {
      await api('/me', { method: 'DELETE' });
    } catch (e) { toast(e.message || 'No se pudo borrar la cuenta'); return; }
    // Borrado OK en el servidor: desuscribir push y limpiar el dispositivo.
    try { const sub = await currentPushSub(); if (sub) { try { await sub.unsubscribe(); } catch (e) {} } } catch (e) {}
    clearSession();
    stopNotifPolling();
    setBadge(0);
    counts = {}; dirty = new Set();
    localStorage.removeItem(LS_COUNTS);
    localStorage.removeItem(LS_DIRTY);
    localStorage.removeItem(LS_COUNTS_OWNER);
    album = CFG.buildAlbum(teams);
    rebuildSidMaps();
    if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect();
    closeModals();
    render();
    toast('Tu cuenta y tus datos fueron borrados');
  }

  // Aviso "app no oficial" en el primer arranque (una sola vez).
  function maybeShowDisclaimer() {
    try { if (localStorage.getItem(LS_DISCLAIMER)) return; } catch {}
    const m = el('modalDisclaimer');
    if (!m) return;
    try { localStorage.setItem(LS_DISCLAIMER, '1'); } catch {}   // marcar visto: no reaparece
    m.classList.add('open');
  }

  async function syncAfterLogin() {
    try {
      const data = await api('/me');
      if (data.user) { me = data.user; saveJSON(LS_USER, me); }
      // Evita mezclar colecciones de cuentas distintas en el mismo dispositivo:
      // si la colección local era de otro usuario, se descarta antes de combinar.
      const ownerTag = String((me && (me.id || me.handle)) || '');
      const prevTag = localStorage.getItem(LS_COUNTS_OWNER);
      if (prevTag && ownerTag && prevTag !== ownerTag) {
        counts = {}; saveJSON(LS_COUNTS, counts);
        dirty = new Set(); saveJSON(LS_DIRTY, []);
      }
      if (ownerTag) localStorage.setItem(LS_COUNTS_OWNER, ownerTag);
      // Sync personal: combina la colección local con la del server por máximo.
      const server = data.counts || {};
      let changed = false;
      album.stickers.forEach((s) => {
        if (!s.sid) return;
        const local = counts[s.key] || 0, srv = server[s.sid] || 0, mx = Math.max(local, srv);
        if (mx !== local) { counts[s.key] = mx; changed = true; }
      });
      if (changed) saveJSON(LS_COUNTS, counts);
      dirty = new Set(Object.keys(countsBySid()));   // subir todo lo combinado
      saveJSON(LS_DIRTY, [...dirty]);
      await flushDirty();
      render();
      updateCloudUI();
      loadNotifications();      // refresca campanita con la colección ya subida
      startNotifPolling();
      await processPendingInvite();   // ?add=<handle> (invitación de amigo)
      await loadFriendsData();
      if (currentView === 'home') renderDashboard();
    } catch (e) { /* offline: seguimos en modo local */ }
  }

  // -- Amigos --
  function openFriends() {
    el('modalFriends').classList.add('open');
    updateCloudUI();
    if (loggedIn()) renderFriends();
  }

  async function renderFriends() {
    const wrap = el('friendsBody');
    if (!wrap) return;
    if (!loggedIn()) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = '<div class="hint">Cargando…</div>';
    try {
      const data = await api('/friends');
      lastFriends = data || { friends: [], incoming: [] };
      let html = '';
      if (data.incoming && data.incoming.length) {
        html += '<h2 style="font-size:1rem">Solicitudes</h2>';
        data.incoming.forEach((u) => {
          html += `<div class="friend-row"><div class="friend-name">${escapeHtml(u.name || u.handle)}<div class="friend-handle">@${escapeHtml(u.handle)}</div></div>
            <button class="fr-ok fr-accept" data-h="${escapeHtml(u.handle)}">Aceptar</button></div>`;
        });
      }
      html += '<h2 style="font-size:1rem;margin-top:14px">Mis amigos</h2>';
      if (!data.friends || !data.friends.length) {
        html += '<p class="hint">Aún no tienes amigos. Comparte tu código y agrega el de otros arriba.</p>';
      } else {
        data.friends.forEach((f) => {
          const u = f.user;
          html += `<div class="friend-row"><div class="friend-name">${escapeHtml(u.name || u.handle)}
              <div class="friend-handle">🟢 te da ${f.they_give_me} · 🔵 le das ${f.i_give_them}</div></div>
            <button class="watch-toggle ${f.watch ? 'on' : ''}" data-h="${escapeHtml(u.handle)}" data-on="${f.watch ? 1 : 0}" title="Vigilar para avisarte de coincidencias">🔔</button>
            <button class="fr-view fr-view-btn" data-h="${escapeHtml(u.handle)}">Ver</button></div>`;
        });
      }
      wrap.innerHTML = html;
      wrap.querySelectorAll('.fr-accept').forEach((b) => b.addEventListener('click', () => acceptFriend(b.dataset.h)));
      wrap.querySelectorAll('.fr-view-btn').forEach((b) => b.addEventListener('click', () => viewMatches(b.dataset.h)));
      wrap.querySelectorAll('.watch-toggle').forEach((b) => b.addEventListener('click', () => {
        const on = b.dataset.on === '1' ? 0 : 1;
        b.dataset.on = on ? '1' : '0';
        b.classList.toggle('on', !!on);
        toggleWatch(b.dataset.h, !!on);
      }));
    } catch (e) { wrap.innerHTML = '<p class="hint">No se pudo cargar (¿API configurada y desplegada?).</p>'; }
  }
  async function addFriend() {
    const raw = (el('friendCode').value || '').trim();
    if (!raw) return;
    // Detecta correo (algo@algo.algo); si no, lo trata como código @handle.
    const isEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw);
    const body = isEmail ? { email: raw } : { handle: raw.replace(/^@/, '') };
    try {
      const r = await api('/friends/request', { method: 'POST', body });
      toast(r.status === 'accepted' ? '¡Ahora son amigos!' : 'Solicitud enviada');
      el('friendCode').value = ''; renderFriends();
    } catch (e) { toast(e.message || 'No se pudo'); }
  }
  async function acceptFriend(h) {
    try { await api('/friends/accept', { method: 'POST', body: { handle: h } }); toast('Amigo aceptado ✓'); renderFriends(); }
    catch (e) { toast(e.message || 'No se pudo'); }
  }
  // Invita por WhatsApp con un link que auto-agrega al invitado tras su login.
  function inviteWhatsApp() {
    if (!loggedIn()) { toast('Inicia sesión para invitar'); return; }
    const link = apiBase() + '/?add=' + encodeURIComponent(me.handle);
    const msg = '¡Te invito a Mis Láminas del Mundial 2026! ⚽📒 Llevamos juntos el álbum y cambiamos repetidas. Entra y te agrego como amigo automáticamente:\n' + link;
    window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
  }

  // -- Invitación entrante (?add=<handle>): se procesa tras el login --
  let pendingAdd = '';
  function captureInviteParams() {
    try {
      const q = new URLSearchParams(location.search);
      const a = (q.get('add') || '').trim().replace(/^@/, '');   if (a) pendingAdd = a;
    } catch {}
  }
  function cleanUrlParam(name) {
    try {
      const u = new URL(location.href); u.searchParams.delete(name);
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch {}
  }
  async function processPendingInvite() {
    if (!loggedIn()) return;
    if (pendingAdd) {
      const h = pendingAdd; pendingAdd = ''; cleanUrlParam('add');
      if (!(me && h.toLowerCase() === (me.handle || '').toLowerCase())) {   // no soy yo
        try {
          const r = await api('/friends/request', { method: 'POST', body: { handle: h } });
          toast(r.status === 'accepted' ? '¡Ahora son amigos!' : 'Solicitud de amistad enviada ✓');
          renderFriends();
        } catch (e) { toast(e.message || 'No se pudo agregar al amigo'); }
      }
    }
  }

  async function viewMatches(h) {
    try {
      const m = await api('/friends/matches?with=' + encodeURIComponent(h));
      const who = m.with.name || m.with.handle;
      const txt = sidListText(m.they_give_me, `🟢 ${who} te puede pasar`) + '\n\n' +
                  sidListText(m.i_give_them, `🔵 Tú le puedes pasar a ${who}`) + '\n\n— Mundial 2026 · Mis Láminas';
      el('matchTitle').textContent = 'Con ' + who;
      el('matchOutput').textContent = txt;
      el('matchOutput').dataset.text = txt;
      el('modalMatch').classList.add('open');
    } catch (e) { toast(e.message || 'No se pudo'); }
  }
  // Lista de sids -> texto agrupado por equipo (con bandera y página).
  function sidListText(sids, header) {
    if (!sids || !sids.length) return header + ':\n(nada)';
    const bySection = {};
    sids.forEach((sid) => { const s = stickerBySid(sid); if (s) (bySection[s.sectionId] = bySection[s.sectionId] || []).push(s); });
    const lines = [header + ' (' + sids.length + '):'];
    album.sections.forEach((sec) => {
      const list = bySection[sec.id]; if (!list) return;
      lines.push(sectionLabel(sec) + ': ' + (sec.kind === 'team' ? rangeStr(list.map((s) => s.disp)) : codeList(list)));
    });
    return lines.join('\n');
  }

  // -- Notificaciones de match --
  let notifPollTimer = null;
  let lastNotif = { unread: 0, items: [] };

  function setBadge(n) {
    const txt = n > 99 ? '99+' : String(n);
    ['notifBadge', 'notifBadgeMenu'].forEach((id) => {
      const b = el(id);
      if (!b) return;
      if (n > 0) { b.textContent = txt; b.hidden = false; }
      else b.hidden = true;
    });
  }

  async function loadNotifications() {
    if (!loggedIn()) return;
    try {
      const data = await api('/notifications');
      lastNotif = data || { unread: 0, items: [] };
      setBadge(lastNotif.unread || 0);
      if (el('modalNotifs') && el('modalNotifs').classList.contains('open')) renderNotifs();
      if (currentView === 'home') renderDashboard();
    } catch (e) { /* silencioso: reintenta al próximo poll */ }
  }

  function renderNotifs() {
    const wrap = el('notifsBody');
    if (!wrap) return;
    const items = lastNotif.items || [];
    if (!items.length) {
      wrap.innerHTML = '<p class="hint">No hay novedades. Cuando un amigo que vigilas tenga láminas que te faltan, aparecerá aquí. 🔔</p>';
      return;
    }
    let html = '';
    items.forEach((n) => {
      const who = n.friend.name || n.friend.handle;
      html += `<div class="notif-row ${n.unread ? 'unread' : ''}">
        <span class="notif-dot ${n.unread ? '' : 'read'}"></span>
        <div class="notif-main">
          <div class="notif-name">${escapeHtml(who)}</div>
          <div class="notif-sub">🟢 te puede pasar <b>${n.they_give}</b>${n.i_give ? ` · 🔵 tú le pasas <b>${n.i_give}</b>` : ''}</div>
        </div>
        <button class="notif-view" data-h="${escapeHtml(n.friend.handle)}">Ver</button>
      </div>`;
    });
    wrap.innerHTML = html;
    wrap.querySelectorAll('.notif-view').forEach((b) => b.addEventListener('click', () => { closeModals(); viewMatches(b.dataset.h); }));
  }

  function openNotifs() {
    if (!loggedIn()) { toast('Inicia sesión para ver tus notificaciones'); return; }
    el('modalNotifs').classList.add('open');
    refreshPushButton();
    renderNotifs();
    // abrir = marcar como leídas (badge a 0); el resaltado se mantiene en esta vista
    if (lastNotif.unread > 0) {
      api('/notifications/read', { method: 'POST', body: { all: true } }).catch(() => {});
      lastNotif.unread = 0;
      setBadge(0);
    }
  }

  async function toggleWatch(handle, on) {
    try { await api('/friends/watch', { method: 'POST', body: { handle, on } }); }
    catch (e) { toast(e.message || 'No se pudo'); return; }
    toast(on ? 'Vigilando 🔔' : 'Dejaste de vigilar');
    loadNotifications();
  }

  function startNotifPolling() {
    stopNotifPolling();
    if (!loggedIn()) return;
    notifPollTimer = setInterval(loadNotifications, 60000);
  }
  function stopNotifPolling() { if (notifPollTimer) { clearInterval(notifPollTimer); notifPollTimer = null; } }

  // -- Web Push (avisos al teléfono) --
  let swReg = null;

  function pushSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window &&
           'Notification' in window && window.isSecureContext;
  }
  async function registerSW() {
    if (!('serviceWorker' in navigator)) return null;
    try { swReg = await navigator.serviceWorker.register('sw.js'); return swReg; }
    catch (e) { return null; }
  }
  function urlB64ToUint8Array(base64) {
    const pad = '='.repeat((4 - (base64.length % 4)) % 4);
    const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(b64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  async function currentPushSub() {
    if (!swReg) return null;
    try { return await swReg.pushManager.getSubscription(); } catch (e) { return null; }
  }
  async function refreshPushButton() {
    const btn = el('btnPush');
    if (!btn) return;
    if (!loggedIn() || !pushSupported()) { btn.style.display = 'none'; return; }
    btn.style.display = '';
    const sub = await currentPushSub();
    const on = !!sub && Notification.permission === 'granted';
    btn.classList.toggle('on', on);
    btn.dataset.on = on ? '1' : '0';
    btn.textContent = on ? '✅ Avisos al teléfono activados (tocar para desactivar)' : '📱 Activar avisos al teléfono';
  }
  async function enablePush() {
    if (!pushSupported()) { toast('Tu navegador/dispositivo no soporta avisos push'); return; }
    if (!swReg) await registerSW();
    if (!swReg) { toast('No se pudo preparar los avisos'); return; }
    let perm = Notification.permission;
    if (perm === 'default') perm = await Notification.requestPermission();
    if (perm !== 'granted') { toast('Diste permiso denegado a las notificaciones'); return; }
    try {
      const sub = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(PUSH_VAPID_PUBLIC),
      });
      await api('/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON() } });
      toast('Avisos activados 📱');
    } catch (e) { toast('No se pudo activar (' + (e.message || 'error') + ')'); }
    refreshPushButton();
  }
  async function disablePush() {
    const sub = await currentPushSub();
    if (sub) {
      try { await api('/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } }); } catch (e) {}
      try { await sub.unsubscribe(); } catch (e) {}
    }
    toast('Avisos al teléfono desactivados');
    refreshPushButton();
  }
  function togglePush() {
    const btn = el('btnPush');
    if (btn && btn.dataset.on === '1') disablePush(); else enablePush();
  }

  // ¿Hay una colección guardada en este dispositivo (de antes de iniciar sesión)?
  function hasLocalData() {
    return Object.keys(counts).some((k) => (counts[k] || 0) > 0);
  }
  // Muestra/oculta el gate de inicio según haya sesión. Sin sesión no se usa la app.
  function updateGate() {
    const gate = el('loginGate');
    if (!gate) return;
    const blocked = !loggedIn();
    gate.hidden = !blocked;
    document.body.classList.toggle('gated', blocked);
    if (blocked) {
      const note = el('gateLocalNote'); if (note) note.hidden = !hasLocalData();
      const ok = renderGoogleButton('gateBtn');
      const loading = el('gateLoading'); if (loading) loading.hidden = ok;
    }
  }

  // Foto de perfil de Google; ajusta el sufijo de tamaño para que salga nítida en el header.
  function avatarUrl(u) {
    const p = (u && u.avatar_url) || '';
    return p ? p.replace(/=s\d+-c\b/, '=s96-c') : '';
  }

  function updateCloudUI() {
    const status = el('acctStatus');
    if (status) {
      if (loggedIn()) status.innerHTML = `Conectado como <b>${escapeHtml(me.name || me.handle)}</b><br><span class="friend-handle">tu código: @${escapeHtml(me.handle)}</span>`;
      else if (!cloudConfigured()) status.textContent = 'Nube sin configurar (opcional). Funciona todo en modo local.';
      else status.textContent = 'No has iniciado sesión.';
    }
    const show = (id, on) => { const e = el(id); if (e) e.style.display = on ? '' : 'none'; };
    show('btnLogin', !loggedIn()); show('gbtn', !loggedIn()); show('btnLogout', loggedIn());
    show('btnDeleteAccount', loggedIn()); show('deleteAccountHint', loggedIn());
    if (!loggedIn()) setBadge(0);
    refreshPushButton();
    const gate = el('friendsGate'); if (gate) gate.style.display = loggedIn() ? 'none' : '';
    const body = el('friendsBody'); if (body && !loggedIn()) body.innerHTML = '';
    const mc = el('myCode'); if (mc) mc.textContent = loggedIn() ? ('@' + me.handle) : '—';
    const av = el('hdrAvatarIni');
    if (av) av.textContent = loggedIn() ? ((me.name || me.handle || '·').trim().charAt(0).toUpperCase() || '·') : '·';
    const avImg = el('hdrAvatarImg'), avBtn = el('hdrAvatar');
    const photo = loggedIn() ? avatarUrl(me) : '';
    if (avImg && avBtn) {
      if (photo) {
        // Si falla la carga (403/red), cae de vuelta a la inicial.
        avImg.onerror = () => { avImg.hidden = true; avBtn.classList.remove('has-photo'); };
        if (avImg.getAttribute('src') !== photo) avImg.src = photo;
        avImg.hidden = false; avBtn.classList.add('has-photo');
      } else {
        avImg.hidden = true; avImg.removeAttribute('src'); avBtn.classList.remove('has-photo');
      }
    }
    updateGate();
  }
  // ===================================================================
  // ==========   DASHBOARD / INICIO + navegación de vistas   ==========
  // ===================================================================
  function setNavActive(id) {
    ['btnHome', 'btnAlbum'].forEach((x) => {
      const b = el(x); if (!b) return;
      const on = x === id;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }
  function showView(view) {
    currentView = view;
    const home = view === 'home';
    const dash = el('dashboard'); if (dash) dash.hidden = !home;
    const tb = el('toolbar'); if (tb) tb.hidden = home;
    const sec = el('sections'); if (sec) sec.hidden = home;
    setNavActive(home ? 'btnHome' : 'btnAlbum');
    if (home) {
      renderDashboard();
      loadFriendsData().then(() => { if (currentView === 'home') renderDashboard(); });
      window.scrollTo(0, 0);
    }
    try { window.dispatchEvent(new Event('resize')); } catch {}   // recalcula --header-h
  }

  async function loadFriendsData() {
    if (!loggedIn()) { lastFriends = { friends: [], incoming: [] }; return; }
    try { lastFriends = (await api('/friends')) || { friends: [], incoming: [] }; }
    catch (e) { /* mantener cache anterior */ }
  }

  function renderDashboard() {
    const wrap = el('dashboard');
    if (!wrap || currentView !== 'home') return;
    if (!loggedIn()) { wrap.innerHTML = ''; return; }
    const st = stats();
    const pct = st.total ? Math.round((st.have / st.total) * 100) : 0;
    const fr = lastFriends || { friends: [], incoming: [] };
    const pending = (fr.incoming || []).length;
    const matchFriends = (fr.friends || []).filter((f) => f.they_give_me > 0).slice(0, 3);
    const unread = (lastNotif && lastNotif.unread) || 0;
    const notifItems = ((lastNotif && lastNotif.items) || []).slice(0, 3);

    const firstName = escapeHtml(((me && (me.name || me.handle)) || '').split(' ')[0] || 'crack');
    let html = '';
    html += `<div class="dash-greet">¡Hola, ${firstName}! <span class="dash-greet-wave">👋</span></div>`;
    html += `<section class="dash-hero">
        <div class="ring" style="--p:${pct}"><span class="ring-val">${pct}%</span></div>
        <div class="dash-hero-info">
          <div class="dash-count">${st.have} / ${st.total}</div>
          <div class="dash-sub">láminas en tu álbum</div>
          <div class="dash-chips">
            <span class="dash-chip ok">✅ ${st.have}</span>
            <span class="dash-chip">⬜ ${st.missing}</span>
            <span class="dash-chip warn">🔁 ${st.repesTotal}</span>
          </div>
        </div>
        <button class="dash-cta" id="dashGoAlbum">Seguir completando →</button>
      </section>`;

    html += `<button class="dash-card" id="dashFriendsCard">
        <div class="dash-card-head">
          <div class="dash-card-title"><span class="em">👥</span>Amigos</div>
          ${pending ? `<span class="dash-pill">${pending} solicitud${pending > 1 ? 'es' : ''}</span>` : '<span class="dash-chevron">›</span>'}
        </div>`;
    if (matchFriends.length) {
      matchFriends.forEach((f) => {
        html += `<div class="dash-row"><div class="dash-row-main">
            <div class="dash-row-title">${escapeHtml(f.user.name || f.user.handle)}</div>
            <div class="dash-row-sub">tiene ${f.they_give_me} que te faltan</div>
          </div><span class="dash-pill green">${f.they_give_me}</span></div>`;
      });
    } else {
      html += `<div class="dash-empty">${(fr.friends || []).length ? 'Ninguna coincidencia nueva ahora.' : 'Agrega amigos para cambiar láminas.'}</div>`;
    }
    html += `</button>`;

    html += `<button class="dash-card" id="dashNotifsCard">
        <div class="dash-card-head">
          <div class="dash-card-title"><span class="em">🔔</span>Avisos</div>
          ${unread ? `<span class="dash-pill">${unread} nuevo${unread > 1 ? 's' : ''}</span>` : '<span class="dash-chevron">›</span>'}
        </div>`;
    if (notifItems.length) {
      notifItems.forEach((n) => {
        html += `<div class="dash-row"><div class="dash-row-main">
            <div class="dash-row-title">${escapeHtml(n.friend.name || n.friend.handle)}</div>
            <div class="dash-row-sub">te puede pasar ${n.they_give}</div>
          </div>${n.unread ? '<span class="dash-pill">nuevo</span>' : ''}</div>`;
      });
    } else {
      html += `<div class="dash-empty">Sin novedades por ahora.</div>`;
    }
    html += `</button>`;

    html += `<div class="dash-actions">
        <button class="dash-action" id="dashActLists"><span class="da-i">📋</span>Listas</button>
        <button class="dash-action" id="dashActInvite"><span class="da-i">🟢</span>Invitar</button>
        <button class="dash-action" id="dashActPush"><span class="da-i">📱</span>Avisos al teléfono</button>
      </div>`;

    wrap.innerHTML = html;
    const w = (id, fn) => { const e = el(id); if (e) e.addEventListener('click', fn); };
    w('dashGoAlbum', () => showView('album'));
    w('dashFriendsCard', openFriends);
    w('dashNotifsCard', openNotifs);
    w('dashActLists', openLists);
    w('dashActInvite', inviteWhatsApp);
    w('dashActPush', togglePush);
  }

  // Diálogo de confirmación temático (reemplaza confirm()/alert() nativos).
  function confirmDialog(message, opts = {}) {
    return new Promise((resolve) => {
      const back = document.createElement('div');
      back.className = 'modal-back';
      back.innerHTML = `<div class="modal confirm-card" role="dialog" aria-modal="true">
          <div class="confirm-msg">${escapeHtml(message)}</div>
          <div class="confirm-actions">
            <button class="confirm-cancel" type="button">${escapeHtml(opts.cancel || 'Cancelar')}</button>
            <button class="confirm-ok ${opts.danger ? 'danger' : ''}" type="button">${escapeHtml(opts.ok || 'Confirmar')}</button>
          </div>
        </div>`;
      document.body.appendChild(back);
      const close = (val) => { back.classList.remove('open'); setTimeout(() => back.remove(), 250); document.removeEventListener('keydown', onKey); resolve(val); };
      const onKey = (e) => { if (e.key === 'Escape') close(false); };
      back.querySelector('.confirm-cancel').addEventListener('click', () => close(false));
      back.querySelector('.confirm-ok').addEventListener('click', () => close(true));
      back.addEventListener('click', (e) => { if (e.target === back) close(false); });
      document.addEventListener('keydown', onKey);
      requestAnimationFrame(() => { back.classList.add('open'); const ok = back.querySelector('.confirm-ok'); if (ok) ok.focus(); });
    });
  }

  // ---------- Eventos ----------
  function bind() {
    el('search').addEventListener('input', (e) => {
      search = e.target.value.trim();
      const sb = el('btnSearch'); if (sb) sb.classList.toggle('active', !!search);
      renderSections();
    });
    document.querySelectorAll('.filters button').forEach((b) => {
      b.addEventListener('click', () => {
        filter = b.dataset.filter;
        document.querySelectorAll('.filters button').forEach((x) => x.classList.toggle('active', x === b));
        renderSections();
      });
    });
    { const ab = el('btnAbout'); if (ab) ab.addEventListener('click', openAbout); }
    document.querySelectorAll('.lp-start-btn').forEach((lp) => { lp.addEventListener('click', () => { const g = el('loginGate'); if (g) g.scrollTo({ top: 0, behavior: 'smooth' }); promptGoogle(); }); });
    document.querySelectorAll('[data-close]').forEach((x) => x.addEventListener('click', closeModals));
    document.querySelectorAll('.modal-back').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) closeModals(); }));

    el('tabMissing').addEventListener('click', () => { listsTab = 'missing'; refreshListsModal(); });
    el('tabRepes').addEventListener('click', () => { listsTab = 'repes'; refreshListsModal(); });
    el('actWhatsapp').addEventListener('click', () => shareWhatsApp(el('listOutput').dataset.text || ''));
    el('actCopy').addEventListener('click', () => copyText(el('listOutput').dataset.text || ''));
    el('actShare').addEventListener('click', () => shareText(el('listOutput').dataset.text || ''));

    el('actExport').addEventListener('click', exportData);
    el('importFile').addEventListener('change', (e) => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ''; });
    el('actSaveTeams').addEventListener('click', saveTeams);
    el('actResetTeams').addEventListener('click', resetTeams);
    el('actResetAll').addEventListener('click', resetAll);

    // Nube / amigos
    const on = (id, ev, fn) => { const e = el(id); if (e) e.addEventListener(ev, fn); };
    on('btnHome', 'click', () => showView('home'));
    on('btnAlbum', 'click', () => showView('album'));
    on('btnLists', 'click', openLists);
    on('hdrAvatar', 'click', openMenu);
    on('btnFriends', 'click', openFriends);
    on('btnAvisos', 'click', () => { closeModals(); openNotifs(); });
    on('btnPush', 'click', togglePush);
    on('btnLogin', 'click', promptGoogle);
    on('btnLogout', 'click', doLogout);
    on('btnDeleteAccount', 'click', deleteAccount);
    on('btnDisclaimerOk', 'click', () => { const m = el('modalDisclaimer'); if (m) m.classList.remove('open'); });
    on('addFriendBtn', 'click', addFriend);
    on('inviteWhatsapp', 'click', inviteWhatsApp);
    on('copyCode', 'click', () => copyText(me ? '@' + me.handle : ''));
    on('matchWhatsapp', 'click', () => shareWhatsApp(el('matchOutput').dataset.text || ''));
    on('matchCopy', 'click', () => copyText(el('matchOutput').dataset.text || ''));
  }

  // ---------- Header compacto + sticky al hacer scroll ----------
  function setupStickyHeader() {
    const header = document.querySelector('.app-header');
    if (!header) return;
    const root = document.documentElement;
    const syncH = () => root.style.setProperty('--header-h', header.offsetHeight + 'px');
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        document.body.classList.toggle('scrolled', window.scrollY > 24);
        syncH();                       // la altura cambia al compactar → la toolbar lo sigue
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', syncH);
    header.addEventListener('transitionend', syncH);  // sync final tras la animación
    syncH();
    onScroll();                        // estado inicial correcto si la página ya viene scrolleada
  }

  // ---------- Init ----------
  captureInviteParams();   // lee ?add=<handle> antes del login para procesarlo después
  rebuildSidMaps();
  bind();
  // a11y: marca los paneles como diálogos y permite cerrarlos con ESC.
  document.querySelectorAll('.modal-back > .modal').forEach((m) => {
    m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.querySelector('.modal-back.open')) closeModals();
  });
  setupStickyHeader();
  render();
  updateCloudUI();
  showView('home');   // landing = Inicio (dashboard)
  maybeShowDisclaimer();   // aviso "app no oficial" (una sola vez)
  // El script de Google es async: apenas cargue, inicializa y pinta el botón
  // del gate (login obligatorio). Robusto aunque cargue después del 'load'.
  whenGoogleReady(() => { initGoogle(); updateGate(); });
  // Loader de arranque: se oculta cuando la app renderizó y (si hay sesión) sincronizó
  // la colección. Mínimo visible ~600ms para que no parpadee; failsafe por si la red cuelga.
  const _loaderStart = Date.now();
  function hideAppLoader() {
    const l = el('appLoader');
    if (!l || l.classList.contains('hide')) return;
    const wait = Math.max(0, 600 - (Date.now() - _loaderStart));
    setTimeout(() => {
      l.classList.add('hide');
      setTimeout(() => { if (l.parentNode) l.parentNode.removeChild(l); }, 500);
    }, wait);
  }
  setTimeout(hideAppLoader, 4000);   // failsafe: nunca dejar el loader pegado
  // Sincroniza si ya hay sesión y prepara el Service Worker para push.
  window.addEventListener('load', () => {
    initGoogle();
    updateGate();
    if (loggedIn() && cloudConfigured()) syncAfterLogin().finally(hideAppLoader);
    else hideAppLoader();
    registerSW().then(refreshPushButton);   // prepara el Service Worker para push
  });
  // Al volver a la pestaña/app, refresca la campanita.
  window.addEventListener('focus', () => {
    if (!loggedIn()) return;
    loadNotifications();
  });
})();
