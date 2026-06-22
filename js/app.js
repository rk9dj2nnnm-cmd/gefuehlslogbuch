let entries = [];
let selectedKeys = new Set();   // ausgewählte Grund- und/oder Unterkategorien
let expandedGroups = new Set(); // welche Grundgefühle aktuell aufgeklappt sind

const $ = (id) => document.getElementById(id);

function todayLabel() {
  const d = new Date();
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}

/* ---------- Himmel: ein Blob pro Grundgefühl, kreisförmig verteilt ---------- */
function createSkyBlobs() {
  const sky = $('sky');
  const skyContent = sky.querySelector('.sky-content');
  MOODS.forEach((group, i) => {
    const angle = (i / MOODS.length) * 2 * Math.PI;
    const x = Math.round(50 + 32 * Math.cos(angle));
    const y = Math.round(50 + 32 * Math.sin(angle));
    const blob = document.createElement('div');
    blob.className = 'blob';
    blob.id = 'blob-' + group.key;
    blob.style.background = `radial-gradient(circle at ${x}% ${y}%, ${group.color}, #161B30 70%)`;
    sky.insertBefore(blob, skyContent);
  });
}

function activeGroupKeys() {
  const active = new Set();
  MOODS.forEach(group => {
    const groupSelected = selectedKeys.has(group.key);
    const childSelected = group.children.some(c => selectedKeys.has(c.key));
    if (groupSelected || childSelected) active.add(group.key);
  });
  return active;
}

function updateSky() {
  const active = activeGroupKeys();
  MOODS.forEach(group => {
    const blob = $('blob-' + group.key);
    if (blob) blob.classList.toggle('active', active.has(group.key));
  });
}

/* ---------- Mood-Auswahl (Grundgefühle + aufklappbare Unterkategorien) ---------- */
function renderMoodGroups() {
  const el = $('moodGroups');
  el.innerHTML = '';

  MOODS.forEach(group => {
    const row = document.createElement('div');
    row.className = 'mood-group-row';

    const groupBtn = document.createElement('button');
    groupBtn.className = 'mood-btn' + (selectedKeys.has(group.key) ? ' selected' : '');
    groupBtn.style.setProperty('--mood-color', group.color);
    groupBtn.innerHTML = `<span class="mood-dot" style="background:${group.color}"></span>${group.label}`;
    groupBtn.addEventListener('click', () => toggleSelection(group.key));

    const expandBtn = document.createElement('button');
    expandBtn.className = 'expand-btn' + (expandedGroups.has(group.key) ? ' expanded' : '');
    expandBtn.setAttribute('aria-label', 'Unterkategorien von ' + group.label + ' anzeigen');
    expandBtn.textContent = '▾';
    expandBtn.addEventListener('click', () => toggleExpanded(group.key));

    row.appendChild(groupBtn);
    row.appendChild(expandBtn);
    el.appendChild(row);

    const children = document.createElement('div');
    children.className = 'mood-children' + (expandedGroups.has(group.key) ? ' open' : '');
    group.children.forEach(child => {
      const childBtn = document.createElement('button');
      childBtn.className = 'mood-btn child' + (selectedKeys.has(child.key) ? ' selected' : '');
      childBtn.style.setProperty('--mood-color', group.color);
      childBtn.innerHTML = `<span class="mood-dot" style="background:${group.color}"></span>${child.label}`;
      childBtn.addEventListener('click', () => toggleSelection(child.key));
      children.appendChild(childBtn);
    });
    el.appendChild(children);
  });
}

function toggleSelection(key) {
  if (selectedKeys.has(key)) selectedKeys.delete(key);
  else selectedKeys.add(key);
  renderMoodGroups();
  updateSky();
  updateButtons();
}

function toggleExpanded(groupKey) {
  if (expandedGroups.has(groupKey)) expandedGroups.delete(groupKey);
  else expandedGroups.add(groupKey);
  renderMoodGroups();
}

function selectedMoodChips() {
  // für die Anzeige in gespeicherten Einträgen: {label, color}
  return [...selectedKeys].map(key => {
    const found = findMoodNode(key);
    if (!found) return { label: key, color: '#888' };
    return { label: found.node.label, color: found.group.color };
  });
}

function updateButtons() {
  const text = $('entryText').value.trim();
  const ready = selectedKeys.size > 0 && text.length > 0;
  $('saveBtn').disabled = !ready;
}

/* ---------- Speichern / Laden (Supabase, pro Nutzer durch RLS getrennt) ---------- */
async function loadEntries() {
  const { data, error } = await supabaseClient
    .from('entries')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Laden fehlgeschlagen', error);
    return [];
  }
  return data;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ---------- Emotionswetter-Streifen ---------- */
function renderStrip() {
  const strip = $('strip');
  strip.innerHTML = '';
  entries.forEach(e => {
    const chips = e.moods || [];
    const bar = document.createElement('div');
    bar.className = 'strip-bar';
    const h = 16 + (e.intensity || 3) * 8;
    bar.style.height = h + 'px';
    bar.style.background = chips.length ? chips[0].color : '#888';
    bar.title = formatDate(e.created_at) + ' · ' + chips.map(c => c.label).join(', ');
    bar.addEventListener('click', () => {
      const target = document.getElementById('entry-' + e.id);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    strip.appendChild(bar);
  });
}

function renderEntries() {
  const list = $('entriesList');
  if (entries.length === 0) {
    list.innerHTML = '<p class="empty-state">Noch keine Einträge. Dein erster Eintrag erscheint hier, sobald du ihn speicherst.</p>';
    return;
  }
  list.innerHTML = '';
  [...entries].reverse().forEach(e => {
    const chips = e.moods || [];
    const card = document.createElement('div');
    card.className = 'entry';
    card.id = 'entry-' + e.id;

    const moodHtml = chips.map(c => `<span><span class="mood-dot" style="background:${c.color}"></span>${c.label}</span>`).join(' · ');

    card.innerHTML = `
      <div class="entry-head">
        <span class="entry-mood">${moodHtml} · ${e.intensity}/5</span>
        <span class="entry-date">${formatDate(e.created_at)}</span>
      </div>
      <p class="entry-text">${escapeHtml(e.text)}</p>
    `;
    list.appendChild(card);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- Eintrag speichern ---------- */
async function saveEntry() {
  const text = $('entryText').value.trim();
  if (selectedKeys.size === 0 || !text) return;
  const intensity = parseInt($('intensity').value, 10);

  $('saveBtn').disabled = true;

  const { data, error } = await supabaseClient
    .from('entries')
    .insert({ moods: selectedMoodChips(), intensity, text })
    .select()
    .single();

  if (error) {
    console.error('Speichern fehlgeschlagen', error);
    $('saveBtn').disabled = false;
    return;
  }

  entries.push(data);
  resetDraft();
  renderStrip();
  renderEntries();
}

function resetDraft() {
  $('entryText').value = '';
  $('intensity').value = 3;
  selectedKeys = new Set();
  expandedGroups = new Set();
  renderMoodGroups();
  updateSky();
  updateButtons();
}

async function init() {
  $('todayLabel').textContent = todayLabel();
  createSkyBlobs();
  renderMoodGroups();
  entries = await loadEntries();
  renderStrip();
  renderEntries();

  $('entryText').addEventListener('input', updateButtons);
  $('saveBtn').addEventListener('click', saveEntry);
}

window.authReady.then((user) => {
  if (user) init();
});
