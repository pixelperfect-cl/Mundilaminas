/* Mundial 2026 · Mis Láminas — lógica de la app (vanilla JS, localStorage) */
(function () {
  'use strict';

  const CFG = window.ALBUM_CONFIG;
  const LS_COUNTS = 'wc26-counts';
  const LS_TEAMS = 'wc26-teams';
  const LS_OPEN = 'wc26-open-sections';

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
    render();
    closeModals();
    toast('Equipos guardados ✓');
  }

  function resetTeams() {
    if (!confirm('¿Restaurar los 48 equipos por defecto? (No borra tus láminas marcadas)')) return;
    teams = clone(CFG.DEFAULT_TEAMS);
    saveJSON(LS_TEAMS, teams);
    album = CFG.buildAlbum(teams);
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
        render();
        closeModals();
        toast('Respaldo importado ✓');
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
  }

  // ---------- Init ----------
  bind();
  render();
})();
