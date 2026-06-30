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
  const LS_ALBUM = 'wc26-current-album';   // álbum activo recordado entre recargas
  const LS_COUNTS_OWNER = 'wc26-counts-owner';  // dueño de la colección local (evita fuga entre cuentas)

  // Configuración de la nube. Estos valores por defecto se rellenan una vez
  // (al desplegar): URL de la API en Cloudways y Client ID de Google.
  // También se pueden setear desde el menú (se guardan en localStorage).
  const DEFAULT_API_BASE = 'https://phpstack-1279051-6519515.cloudwaysapps.com';
  const DEFAULT_CLIENT_ID = '598312536196-siqndl4beehru3lnvp6vlqica4ufc27m.apps.googleusercontent.com';
  // Clave pública VAPID para Web Push (la privada vive solo en el server).
  const PUSH_VAPID_PUBLIC = 'BAVsswPfELLnzsdNvZgX3P5T0FCHcJ03FNNRDOR6Eqzl5m8huHpJrfZv1Goo18pcYn0GUzZhgFqkcW-W32RdocI';

  // ---------- Estado ----------
  let counts = loadJSON(LS_COUNTS, {});            // { stickerKey: copiasQueTengo }
  let teams = loadJSON(LS_TEAMS, null) || clone(CFG.DEFAULT_TEAMS);
  let openSections = new Set(loadJSON(LS_OPEN, []));
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
    if (isShared()) return sharedCounts[key] || 0;
    return counts[key] || 0;
  }
  function setCount(key, n) {
    n = Math.max(0, n | 0);
    if (isShared()) {                       // compartido: edición por delta
      const prev = sharedCounts[key] || 0;
      const delta = n - prev;
      if (delta === 0) return;
      if (n === 0) delete sharedCounts[key]; else sharedCounts[key] = n;
      queueSharedDelta(key, delta);
      return;
    }
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
  // SIEMPRE personal (no usar getCount: en modo compartido devolvería el POOL
  // y el PUT /me/collection corrompería la colección personal del usuario).
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
      if (!String(s.disp).includes(q) && !s.label.toLowerCase().includes(q) &&
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
      const isOpen = openSections.has(section.id) || !!search || filter !== 'all';

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
      `;
      head.addEventListener('click', () => {
        if (openSections.has(section.id)) openSections.delete(section.id);
        else openSections.add(section.id);
        saveJSON(LS_OPEN, [...openSections]);
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
      <div class="num">#${s.disp}</div>
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
        miniEl.classList.toggle('done', ss.have === ss.total);
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

  function buildMissingText() {
    const lines = ['🟥 ME FALTAN — Mundial 2026', ''];
    let total = 0;
    album.sections.forEach((section) => {
      const miss = section.stickers.filter((s) => getCount(s.key) === 0);
      if (!miss.length) return;
      total += miss.length;
      const title = sectionLabel(section);
      lines.push(`${title}: ` + miss.map((s) => '#' + s.disp).join(', '));
    });
    lines.splice(1, 0, `Total: ${total} láminas`);
    if (total === 0) return '🎉 ¡No te falta ninguna! Álbum completo.';
    return lines.join('\n');
  }

  function buildRepesText() {
    const lines = ['🔁 REPETIDAS (para cambiar) — Mundial 2026', ''];
    let total = 0;
    album.sections.forEach((section) => {
      const reps = section.stickers
        .map((s) => ({ s, r: Math.max(0, getCount(s.key) - 1) }))
        .filter((x) => x.r > 0);
      if (!reps.length) return;
      const title = sectionLabel(section);
      reps.forEach((x) => total += x.r);
      lines.push(`${title}: ` + reps.map((x) => `#${x.s.disp}${x.r > 1 ? ' (x' + x.r + ')' : ''}`).join(', '));
    });
    lines.splice(1, 0, `Total repetidas: ${total}`);
    if (total === 0) return 'No tienes láminas repetidas todavía.';
    return lines.join('\n');
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

  // ---------- Álbum activo (personal vs compartido) ----------
  // currentAlbum: {type:'personal'} | {type:'shared', id, name, ownerHandle}
  let currentAlbum = { type: 'personal' };
  let myAlbums = [];          // cache de GET /albums/mine
  let sharedCounts = {};      // por KEY (convertido desde sid) del compartido activo
  let sharedSince = 0;        // ts del último GET para polling incremental
  let sharedPending = {};     // { sid: deltaAcumulado } pendiente de enviar
  let sharedFlushTimer = null, albumPollTimer = null;
  function isShared() { return currentAlbum.type === 'shared'; }

  // Vista activa (Inicio/dashboard vs Álbum/grilla) y cache de amigos para el dashboard.
  let currentView = 'home';
  let lastFriends = { friends: [], incoming: [] };

  function apiBase() { return (localStorage.getItem(LS_API) || DEFAULT_API_BASE || '').replace(/\/+$/, ''); }
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
    stopAlbumPolling();
    currentAlbum = { type: 'personal' }; sharedCounts = {}; sharedPending = {}; sharedSince = 0; myAlbums = [];
    localStorage.removeItem(LS_ALBUM);
    setBadge(0);
    updateAlbumChip();
    render();
    renderAlbumsSection();
    if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect();
    toast('Sesión cerrada');
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
      await loadMyAlbums();
      const owned = myOwnedAlbum();
      const remembered = loadJSON(LS_ALBUM, null);
      const remOk = remembered && remembered.type === 'shared' && myAlbums.some((a) => a.id === remembered.id);
      if (owned) {
        // Mi álbum ya es compartido: el pool ES mi collection en el server.
        // NO hago el merge/PUT personal absoluto (clobberearía aportes y filas qty=0).
        updateCloudUI();
        await switchAlbum({ type: 'shared', id: owned.id, name: owned.name });
      } else if (remOk) {
        // Retomar el álbum compartido en que estaba (miembro).
        updateCloudUI();
        const a = myAlbums.find((x) => x.id === remembered.id);
        await switchAlbum({ type: 'shared', id: a.id, name: a.name, ownerHandle: a.owner_handle });
      } else {
        if (remembered) localStorage.removeItem(LS_ALBUM);   // estaba pero ya no soy miembro
        // Sync personal (modo de siempre): combina LS con el server por máximo.
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
      }
      loadNotifications();      // refresca campanita con la colección ya subida
      startNotifPolling();
      await processPendingInvite();   // ?add=<handle> y/o ?join=<code> (puede cambiar de álbum)
      renderAlbumsSection();
      await loadFriendsData();
      if (currentView === 'home') renderDashboard();
    } catch (e) { /* offline: seguimos en modo local */ }
  }

  // -- Amigos --
  function openFriends() {
    el('modalFriends').classList.add('open');
    updateCloudUI();
    if (loggedIn()) { renderFriends(); loadMyAlbums().then(renderAlbumsSection); }
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

  // -- Invitación entrante (?add=<handle> / ?join=<code>): se procesa tras el login --
  let pendingAdd = '', pendingJoin = '';
  function captureInviteParams() {
    try {
      const q = new URLSearchParams(location.search);
      const a = (q.get('add') || '').trim().replace(/^@/, '');   if (a) pendingAdd = a;
      const j = (q.get('join') || '').trim().toUpperCase();      if (j) pendingJoin = j;
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
    if (pendingJoin) {
      const code = pendingJoin; pendingJoin = ''; cleanUrlParam('join');
      try {
        const r = await api('/albums/join', { method: 'POST', body: { code } });
        toast('Te uniste a "' + r.album.name + '" ✓');
        await loadMyAlbums();
        await switchAlbum({ type: 'shared', id: r.album.id, name: r.album.name, ownerHandle: r.album.owner_handle });
      } catch (e) { toast(e.message || 'No se pudo unir al álbum'); }
    }
  }

  // ===================================================================
  // ==========   ÁLBUMES COMPARTIDOS (deltas + polling)   =============
  // ===================================================================
  function queueSharedDelta(key, delta) {
    const sid = keyToSid[key];
    if (!sid) return;
    sharedPending[sid] = (sharedPending[sid] || 0) + delta;
    clearTimeout(sharedFlushTimer);
    sharedFlushTimer = setTimeout(flushSharedDeltas, 700);
  }
  async function flushSharedDeltas() {
    if (!isShared() || !loggedIn()) return;
    const id = currentAlbum.id;
    const ops = Object.keys(sharedPending)
      .map((sid) => ({ sid, delta: sharedPending[sid] }))
      .filter((o) => o.delta !== 0);
    if (!ops.length) return;
    sharedPending = {};
    try {
      const r = await api('/albums/' + id + '/collection', { method: 'POST', body: { ops } });
      if (r && r.ts) sharedSince = r.ts;
      if (r && r.counts) applySharedCounts(r.counts, true);
    } catch (e) {
      // re-encolar para reintentar al próximo cambio/poll
      ops.forEach((o) => { sharedPending[o.sid] = (sharedPending[o.sid] || 0) + o.delta; });
    }
  }
  // Aplica un mapa {sid: qty} al estado compartido. No pisa sids con cambios
  // locales sin enviar (sharedPending). Re-renderiza si algo cambió y rerender=true.
  function applySharedCounts(countsBySidObj, rerender) {
    let changed = false;
    Object.keys(countsBySidObj || {}).forEach((sid) => {
      if (sharedPending[sid]) return;             // cambio local pendiente: no pisar
      const key = sidToKey[sid];
      if (!key) return;
      const qty = countsBySidObj[sid] | 0;
      if ((sharedCounts[key] || 0) !== qty) {
        if (qty === 0) delete sharedCounts[key]; else sharedCounts[key] = qty;
        changed = true;
      }
    });
    if (changed && rerender) render();
    return changed;
  }
  function startAlbumPolling() {
    stopAlbumPolling();
    if (!isShared()) return;
    albumPollTimer = setInterval(pollSharedAlbum, 12000);
  }
  function stopAlbumPolling() {
    if (albumPollTimer) { clearInterval(albumPollTimer); albumPollTimer = null; }
  }
  async function pollSharedAlbum() {
    if (!isShared() || !loggedIn()) return;
    try {
      await flushSharedDeltas();                  // primero envía lo pendiente
      const id = currentAlbum.id;
      // margen de 2s de solape: evita perder cambios del mismo segundo (ts en seg).
      const since = sharedSince > 2 ? sharedSince - 2 : 0;
      const r = await api('/albums/' + id + '/collection?since=' + since);
      if (r && r.ts) sharedSince = r.ts;
      if (r && r.counts) applySharedCounts(r.counts, true);
    } catch (e) { /* reintenta al próximo tick */ }
  }

  async function switchAlbum(target) {
    clearTimeout(flushTimer); flushTimer = null;   // cancela flush personal agendado
    await flushDirty();                            // persiste lo personal pendiente (no-op si compartido)
    await flushSharedDeltas();                     // no perder lo pendiente del anterior
    stopAlbumPolling();
    if (target && target.type === 'shared') {
      currentAlbum = { type: 'shared', id: target.id, name: target.name, ownerHandle: target.ownerHandle };
      sharedCounts = {}; sharedPending = {}; sharedSince = 0;
      try {
        const r = await api('/albums/' + target.id + '/collection?since=0');
        sharedSince = r.ts || 0;
        applySharedCounts(r.counts || {}, false);
      } catch (e) { toast('No se pudo cargar el álbum compartido'); }
      startAlbumPolling();
    } else {
      currentAlbum = { type: 'personal' };
      sharedCounts = {}; sharedPending = {}; sharedSince = 0;
    }
    // Recordar la elección entre recargas.
    if (currentAlbum.type === 'shared') saveJSON(LS_ALBUM, { type: 'shared', id: currentAlbum.id, name: currentAlbum.name, ownerHandle: currentAlbum.ownerHandle });
    else localStorage.removeItem(LS_ALBUM);
    updateAlbumChip();
    try { window.dispatchEvent(new Event('resize')); } catch {}   // re-sincroniza --header-h (el chip cambia la altura)
    render();
    renderAlbumsSection();
  }

  async function loadMyAlbums() {
    if (!loggedIn()) { myAlbums = []; return; }
    try { const d = await api('/albums/mine'); myAlbums = d.albums || []; }
    catch (e) { myAlbums = []; }
  }
  function myOwnedAlbum() { return myAlbums.find((a) => a.role === 'owner') || null; }

  function updateAlbumChip() {
    const chip = el('albumChip');
    if (!chip) return;
    if (isShared()) {
      chip.hidden = false;
      chip.textContent = '👥 ' + (currentAlbum.name || 'Álbum compartido') + ' · cambiar';
    } else {
      chip.hidden = true;
    }
  }

  function albumRow(o) {
    let actions = '';
    if (o.manage === 'owner') {
      actions += `<button class="mini-btn alb-invite" data-code="${escapeHtml(o.code || '')}" data-name="${escapeHtml(o.name || '')}">🟢 Invitar</button>`;
      actions += `<button class="mini-btn alb-delete" data-id="${o.id}" title="Borrar álbum">🗑️</button>`;
    } else if (o.manage === 'member') {
      actions += `<button class="mini-btn alb-leave" data-id="${o.id}" data-name="${escapeHtml(o.name || '')}">Salir</button>`;
    }
    const data = o.kind === 'shared'
      ? `data-kind="shared" data-id="${o.id}" data-name="${escapeHtml(o.name || '')}" data-owner="${escapeHtml(o.ownerHandle || '')}"`
      : 'data-kind="personal"';
    return `<div class="album-row${o.active ? ' active' : ''}">
        <button class="album-pick" ${data}>
          <div class="album-name">${escapeHtml(o.title)}${o.active ? ' ✓' : ''}</div>
          <div class="album-sub">${escapeHtml(o.sub)}</div>
        </button>${actions ? '<div class="album-actions">' + actions + '</div>' : ''}
      </div>`;
  }

  function renderAlbumsSection() {
    const wrap = el('albumsSection');
    if (!wrap) return;
    if (!loggedIn()) { wrap.hidden = true; wrap.innerHTML = ''; return; }
    wrap.hidden = false;
    const owned = myOwnedAlbum();
    const joined = myAlbums.filter((a) => a.role !== 'owner');
    let html = '<h2 style="font-size:1rem">📚 Mis álbumes</h2>';

    if (owned) {   // mi álbum ya es compartido → no muestro "personal" aparte
      html += albumRow({
        title: '📒 ' + owned.name, sub: owned.members + ' miembro(s) · tú eres el dueño',
        active: isShared() && currentAlbum.id === owned.id,
        id: owned.id, kind: 'shared', name: owned.name, manage: 'owner', code: owned.join_code,
      });
    } else {
      html += albumRow({ title: '📒 Mi álbum', sub: 'Solo tuyo', active: !isShared(), kind: 'personal' });
      html += '<button class="act-share" id="btnShareAlbum" style="width:100%;margin:6px 0 4px">➕ Compartir mi álbum</button>';
    }

    joined.forEach((a) => {
      html += albumRow({
        title: '👥 ' + a.name, sub: 'de @' + a.owner_handle + ' · ' + a.members + ' miembro(s)',
        active: isShared() && currentAlbum.id === a.id,
        id: a.id, kind: 'shared', name: a.name, ownerHandle: a.owner_handle, manage: 'member',
      });
    });

    html += '<div class="add-friend" style="margin-top:8px">'
      + '<input class="search" id="joinCode" placeholder="código de álbum (ej. A1B2C3)" />'
      + '<button class="act-share" id="btnJoinAlbum">Unirme</button></div>';

    wrap.innerHTML = html;
    bindAlbumsSection();
  }

  function bindAlbumsSection() {
    const wrap = el('albumsSection');
    if (!wrap) return;
    wrap.querySelectorAll('.album-pick').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.kind === 'personal') switchAlbum({ type: 'personal' });
      else switchAlbum({ type: 'shared', id: +b.dataset.id, name: b.dataset.name, ownerHandle: b.dataset.owner });
    }));
    const sh = el('btnShareAlbum'); if (sh) sh.addEventListener('click', shareMyAlbum);
    const jb = el('btnJoinAlbum'); if (jb) jb.addEventListener('click', joinAlbumByCode);
    wrap.querySelectorAll('.alb-invite').forEach((b) => b.addEventListener('click', () => inviteAlbumWhatsApp(b.dataset.code, b.dataset.name)));
    wrap.querySelectorAll('.alb-delete').forEach((b) => b.addEventListener('click', () => deleteAlbum(+b.dataset.id)));
    wrap.querySelectorAll('.alb-leave').forEach((b) => b.addEventListener('click', () => leaveAlbum(+b.dataset.id, b.dataset.name)));
  }

  async function shareMyAlbum() {
    if (!loggedIn()) return;
    await flushDirty();   // asegura que el server tenga mi colección antes de compartir
    try {
      const r = await api('/albums/share', { method: 'POST' });
      toast('¡Álbum compartido! Invita con el botón 🟢.');
      await loadMyAlbums();
      await switchAlbum({ type: 'shared', id: r.album.id, name: r.album.name });
    } catch (e) { toast(e.message || 'No se pudo compartir'); }
  }
  async function joinAlbumByCode() {
    const code = (el('joinCode').value || '').trim().toUpperCase();
    if (!code) return;
    try {
      const r = await api('/albums/join', { method: 'POST', body: { code } });
      toast('Te uniste a "' + r.album.name + '" ✓');
      el('joinCode').value = '';
      await loadMyAlbums();
      await switchAlbum({ type: 'shared', id: r.album.id, name: r.album.name, ownerHandle: r.album.owner_handle });
    } catch (e) { toast(e.message || 'No se pudo unir'); }
  }
  function inviteAlbumWhatsApp(code, name) {
    if (!code) { toast('Sin código de álbum'); return; }
    const link = apiBase() + '/?join=' + encodeURIComponent(code);
    const msg = '¡Llenemos juntos el álbum "' + (name || 'Mundial 2026') + '"! ⚽📒 Únete con este link y editamos el mismo conteo de láminas:\n' + link + '\n(o usa el código ' + code + ')';
    window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
  }
  async function deleteAlbum(id) {
    if (!(await confirmDialog('¿Borrar este álbum compartido? Los miembros dejarán de verlo. Tu colección no se pierde.', { ok: 'Borrar', danger: true }))) return;
    try {
      await api('/albums/' + id + '/delete', { method: 'POST' });
      toast('Álbum borrado');
      if (isShared() && currentAlbum.id === id) await switchAlbum({ type: 'personal' });
      await loadMyAlbums();
      renderAlbumsSection();
    } catch (e) { toast(e.message || 'No se pudo'); }
  }
  async function leaveAlbum(id, name) {
    if (!(await confirmDialog('¿Salir de "' + (name || 'este álbum') + '"?', { ok: 'Salir' }))) return;
    try {
      await api('/albums/' + id + '/leave', { method: 'POST' });
      toast('Saliste del álbum');
      if (isShared() && currentAlbum.id === id) await switchAlbum({ type: 'personal' });
      await loadMyAlbums();
      renderAlbumsSection();
    } catch (e) { toast(e.message || 'No se pudo'); }
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
      list.sort((a, b) => a.disp - b.disp);
      lines.push(sectionLabel(sec) + ': ' + list.map((s) => '#' + s.disp).join(', '));
    });
    return lines.join('\n');
  }

  // -- Notificaciones de match --
  let notifPollTimer = null;
  let lastNotif = { unread: 0, items: [] };

  function setBadge(n) {
    const b = el('notifBadge');
    if (!b) return;
    if (n > 0) { b.textContent = n > 99 ? '99+' : n; b.hidden = false; }
    else b.hidden = true;
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

  function updateCloudUI() {
    const status = el('acctStatus');
    if (status) {
      if (loggedIn()) status.innerHTML = `Conectado como <b>${escapeHtml(me.name || me.handle)}</b><br><span class="friend-handle">tu código: @${escapeHtml(me.handle)}</span>`;
      else if (!cloudConfigured()) status.textContent = 'Nube sin configurar (opcional). Funciona todo en modo local.';
      else status.textContent = 'No has iniciado sesión.';
    }
    const show = (id, on) => { const e = el(id); if (e) e.style.display = on ? '' : 'none'; };
    show('btnLogin', !loggedIn()); show('gbtn', !loggedIn()); show('btnLogout', loggedIn());
    if (!loggedIn()) setBadge(0);
    refreshPushButton();
    const gate = el('friendsGate'); if (gate) gate.style.display = loggedIn() ? 'none' : '';
    const body = el('friendsBody'); if (body && !loggedIn()) body.innerHTML = '';
    const mc = el('myCode'); if (mc) mc.textContent = loggedIn() ? ('@' + me.handle) : '—';
    const as = el('albumsSection'); if (as && !loggedIn()) { as.hidden = true; as.innerHTML = ''; }
    updateAlbumChip();
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
    const a = isShared() ? myAlbums.find((x) => x.id === currentAlbum.id) : null;
    const albumTitle = isShared() ? (currentAlbum.name || 'Álbum compartido') : 'Mi álbum';
    const albumSub = isShared()
      ? (a ? ((a.role === 'owner' ? 'Tú eres el dueño' : 'de @' + a.owner_handle) + ' · ' + a.members + ' miembro(s)') : 'Compartido')
      : 'Personal';

    let html = '';
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

    html += `<button class="dash-card" id="dashAlbumCard">
        <div class="dash-card-head">
          <div class="dash-card-title"><span class="em">${isShared() ? '👥' : '📒'}</span>${escapeHtml(albumTitle)}</div>
          <span class="dash-chevron">›</span>
        </div>
        <div class="dash-row-sub">${escapeHtml(albumSub)}</div>
      </button>`;

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
        <button class="dash-action" id="dashActShare"><span class="da-i">👥</span>Compartir</button>
      </div>`;

    wrap.innerHTML = html;
    const w = (id, fn) => { const e = el(id); if (e) e.addEventListener('click', fn); };
    w('dashGoAlbum', () => showView('album'));
    w('dashAlbumCard', openFriends);
    w('dashFriendsCard', openFriends);
    w('dashNotifsCard', openNotifs);
    w('dashActLists', openLists);
    w('dashActInvite', inviteWhatsApp);
    w('dashActShare', openFriends);
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
    el('btnMenu').addEventListener('click', openMenu);
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
    on('btnFriends', 'click', openFriends);
    on('btnNotifs', 'click', openNotifs);
    on('btnPush', 'click', togglePush);
    on('btnLogin', 'click', promptGoogle);
    on('btnLogout', 'click', doLogout);
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
  // El script de Google es async: apenas cargue, inicializa y pinta el botón
  // del gate (login obligatorio). Robusto aunque cargue después del 'load'.
  whenGoogleReady(() => { initGoogle(); updateGate(); });
  // Sincroniza si ya hay sesión y prepara el Service Worker para push.
  window.addEventListener('load', () => {
    initGoogle();
    updateGate();
    if (loggedIn() && cloudConfigured()) syncAfterLogin();
    registerSW().then(refreshPushButton);   // prepara el Service Worker para push
  });
  // Al volver a la pestaña/app, refresca la campanita y el álbum compartido.
  window.addEventListener('focus', () => {
    if (!loggedIn()) return;
    loadNotifications();
    if (isShared()) pollSharedAlbum();
  });
})();
