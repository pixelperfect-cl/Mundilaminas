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

  // Configuración de la nube. Estos valores por defecto se rellenan una vez
  // (al desplegar): URL de la API en Cloudways y Client ID de Google.
  // También se pueden setear desde el menú (se guardan en localStorage).
  const DEFAULT_API_BASE = 'https://phpstack-1279051-6519515.cloudwaysapps.com';
  const DEFAULT_CLIENT_ID = '';  // ← pega aquí el Client ID de Google cuando lo crees

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

  function getCount(key) { return counts[key] || 0; }
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
  function countsBySid() {
    const out = {};
    album.stickers.forEach((s) => { const c = getCount(s.key); if (c > 0 && s.sid) out[s.sid] = c; });
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

      const flag = section.kind === 'team'
        ? `<div class="flag">${section.code || ''}</div>`
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

  function resetTeams() {
    if (!confirm('¿Restaurar los 48 equipos por defecto? (No borra tus láminas marcadas)')) return;
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
        alert('No se pudo leer el archivo. ¿Es un respaldo válido?');
      }
    };
    reader.readAsText(file);
  }

  function resetAll() {
    if (!confirm('¿Borrar TODO (láminas marcadas y equipos)? Esto no se puede deshacer.')) return;
    counts = {}; teams = clone(CFG.DEFAULT_TEAMS); openSections = new Set();
    localStorage.removeItem(LS_COUNTS);
    localStorage.removeItem(LS_TEAMS);
    localStorage.removeItem(LS_OPEN);
    album = CFG.buildAlbum(teams);
    rebuildSidMaps();
    render(); closeModals(); toast('Todo reiniciado');
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
    const all = countsBySid(), payload = {};
    dirty.forEach((sid) => { payload[sid] = all[sid] || 0; });
    try { await api('/me/collection', { method: 'PUT', body: { counts: payload } }); dirty.clear(); saveJSON(LS_DIRTY, []); }
    catch (e) { /* se reintenta al próximo cambio o recarga */ }
  }

  function setSession(token, user) { authToken = token; me = user; localStorage.setItem(LS_TOKEN, token); saveJSON(LS_USER, user); updateCloudUI(); }
  function clearSession() { authToken = ''; me = null; localStorage.removeItem(LS_TOKEN); localStorage.removeItem(LS_USER); updateCloudUI(); }

  // -- Google Identity Services --
  function initGoogle() {
    if (googleReady || !clientId() || !(window.google && google.accounts && google.accounts.id)) return;
    google.accounts.id.initialize({ client_id: clientId(), callback: onGoogleCredential });
    googleReady = true;
  }
  function promptGoogle() {
    if (!cloudConfigured()) { toast('Falta configurar la URL de la API'); return; }
    if (!clientId()) { toast('Falta el Client ID de Google'); return; }
    initGoogle();
    if (!googleReady) { toast('Google aún no carga, reintenta'); return; }
    const cont = el('gbtn');
    if (cont) { cont.innerHTML = ''; google.accounts.id.renderButton(cont, { theme: 'filled_blue', size: 'large', text: 'signin_with', shape: 'pill' }); }
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
    if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect();
    toast('Sesión cerrada');
  }

  async function syncAfterLogin() {
    try {
      const data = await api('/me');
      if (data.user) { me = data.user; saveJSON(LS_USER, me); }
      const server = data.counts || {};
      let changed = false;
      album.stickers.forEach((s) => {
        if (!s.sid) return;
        const local = getCount(s.key), srv = server[s.sid] || 0, mx = Math.max(local, srv);
        if (mx !== local) { counts[s.key] = mx; changed = true; }
      });
      if (changed) saveJSON(LS_COUNTS, counts);
      dirty = new Set(Object.keys(countsBySid()));   // subir todo lo combinado
      saveJSON(LS_DIRTY, [...dirty]);
      await flushDirty();
      render();
      updateCloudUI();
    } catch (e) { /* offline: seguimos en modo local */ }
  }

  // -- Amigos --
  function openFriends() { el('modalFriends').classList.add('open'); updateCloudUI(); if (loggedIn()) renderFriends(); }

  async function renderFriends() {
    const wrap = el('friendsBody');
    if (!wrap) return;
    if (!loggedIn()) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = '<div class="hint">Cargando…</div>';
    try {
      const data = await api('/friends');
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
            <button class="fr-view fr-view-btn" data-h="${escapeHtml(u.handle)}">Ver</button></div>`;
        });
      }
      wrap.innerHTML = html;
      wrap.querySelectorAll('.fr-accept').forEach((b) => b.addEventListener('click', () => acceptFriend(b.dataset.h)));
      wrap.querySelectorAll('.fr-view-btn').forEach((b) => b.addEventListener('click', () => viewMatches(b.dataset.h)));
    } catch (e) { wrap.innerHTML = '<p class="hint">No se pudo cargar (¿API configurada y desplegada?).</p>'; }
  }
  async function addFriend() {
    const h = (el('friendCode').value || '').trim().replace(/^@/, '');
    if (!h) return;
    try {
      const r = await api('/friends/request', { method: 'POST', body: { handle: h } });
      toast(r.status === 'accepted' ? '¡Ahora son amigos!' : 'Solicitud enviada');
      el('friendCode').value = ''; renderFriends();
    } catch (e) { toast(e.message || 'No se pudo'); }
  }
  async function acceptFriend(h) {
    try { await api('/friends/accept', { method: 'POST', body: { handle: h } }); toast('Amigo aceptado ✓'); renderFriends(); }
    catch (e) { toast(e.message || 'No se pudo'); }
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

  function updateCloudUI() {
    const status = el('acctStatus');
    if (status) {
      if (loggedIn()) status.innerHTML = `Conectado como <b>${escapeHtml(me.name || me.handle)}</b><br><span class="friend-handle">tu código: @${escapeHtml(me.handle)}</span>`;
      else if (!cloudConfigured()) status.textContent = 'Nube sin configurar (opcional). Funciona todo en modo local.';
      else status.textContent = 'No has iniciado sesión.';
    }
    const setVal = (id, v) => { const e = el(id); if (e && document.activeElement !== e) e.value = v; };
    setVal('cfgApi', localStorage.getItem(LS_API) || DEFAULT_API_BASE || '');
    setVal('cfgGid', localStorage.getItem(LS_GID) || DEFAULT_CLIENT_ID || '');
    const show = (id, on) => { const e = el(id); if (e) e.style.display = on ? '' : 'none'; };
    show('btnLogin', !loggedIn()); show('gbtn', !loggedIn()); show('btnLogout', loggedIn());
    const gate = el('friendsGate'); if (gate) gate.style.display = loggedIn() ? 'none' : '';
    const body = el('friendsBody'); if (body && !loggedIn()) body.innerHTML = '';
    const mc = el('myCode'); if (mc) mc.textContent = loggedIn() ? ('@' + me.handle) : '—';
  }
  function saveCloudCfg() {
    const a = (el('cfgApi').value || '').trim().replace(/\/+$/, ''), g = (el('cfgGid').value || '').trim();
    if (a) localStorage.setItem(LS_API, a); else localStorage.removeItem(LS_API);
    if (g) localStorage.setItem(LS_GID, g); else localStorage.removeItem(LS_GID);
    googleReady = false; initGoogle();
    toast('Configuración guardada'); updateCloudUI();
  }

  // ---------- Eventos ----------
  function bind() {
    el('search').addEventListener('input', (e) => { search = e.target.value.trim(); renderSections(); });
    document.querySelectorAll('.filters button').forEach((b) => {
      b.addEventListener('click', () => {
        filter = b.dataset.filter;
        document.querySelectorAll('.filters button').forEach((x) => x.classList.toggle('active', x === b));
        renderSections();
      });
    });
    el('btnLists').addEventListener('click', openLists);
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
    on('btnFriends', 'click', openFriends);
    on('btnLogin', 'click', promptGoogle);
    on('btnLogout', 'click', doLogout);
    on('addFriendBtn', 'click', addFriend);
    on('saveCfgBtn', 'click', saveCloudCfg);
    on('copyCode', 'click', () => copyText(me ? '@' + me.handle : ''));
    on('matchWhatsapp', 'click', () => shareWhatsApp(el('matchOutput').dataset.text || ''));
    on('matchCopy', 'click', () => copyText(el('matchOutput').dataset.text || ''));
  }

  // ---------- Init ----------
  rebuildSidMaps();
  bind();
  render();
  updateCloudUI();
  // Inicializa Google y sincroniza si ya hay sesión (cuando todo cargó).
  window.addEventListener('load', () => {
    initGoogle();
    if (loggedIn() && cloudConfigured()) syncAfterLogin();
  });
})();
