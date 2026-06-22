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
  if (selectedKeys.has(key)) {
    selectedKeys.delete(key);
  } else {
    selectedKeys.add(key);
    // Beim Auswählen eines Grundgefühls direkt die Unterkategorien aufklappen,
    // man muss aber nicht weiter spezifizieren, wenn man nicht will.
    const isGroup = MOODS.some(g => g.key === key);
    if (isGroup) expandedGroups.add(key);
  }
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
      <div class="reflection-box" id="reflection-${e.id}">
        <button class="ghost reflect-btn" data-id="${e.id}">✨ KI-Reflexion</button>
      </div>
    `;
    list.appendChild(card);
  });

  // Laufende Reflexionsgespräche überleben den Neuaufbau der Liste (z.B. nach dem Speichern eines neuen Eintrags).
  Object.keys(conversations).forEach((entryId) => renderReflectionBox(entryId));
}

/* ---------- KI-Reflexionsgespräch (Gemini über eigene Vercel-Function) ---------- */
const conversations = {}; // entry.id -> { messages: [{role, text}], history: [...Gemini-Contents], loading }

function renderReflectionBox(entryId) {
  const box = $('reflection-' + entryId);
  const convo = conversations[entryId];

  if (!convo) {
    box.innerHTML = `<button class="ghost reflect-btn" data-id="${entryId}">✨ KI-Reflexion</button>`;
    return;
  }

  const messagesHtml = convo.messages
    .map((m) => `<p class="reflection-msg ${m.role}">${escapeHtml(m.text)}</p>`)
    .join('');
  const loadingHtml = convo.loading ? '<p class="reflection-msg model loading">Denkt nach …</p>' : '';
  const inputHtml = convo.loading
    ? ''
    : `<div class="reflection-input-row">
         <input type="text" class="reflection-input" placeholder="Antworten …" />
         <button class="ghost reflection-send">Senden</button>
       </div>`;

  box.innerHTML = messagesHtml + loadingHtml + inputHtml;
}

async function startReflection(entry) {
  conversations[entry.id] = { messages: [], history: [], loading: true };
  renderReflectionBox(entry.id);

  try {
    const res = await fetch('/api/reflect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry: { text: entry.text, moods: entry.moods, intensity: entry.intensity } })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Fehler');
    conversations[entry.id].history = data.history;
    conversations[entry.id].messages.push({ role: 'model', text: data.reply });
  } catch (err) {
    console.error(err);
    conversations[entry.id].messages.push({ role: 'model', text: 'Reflexion konnte nicht geladen werden.' });
  } finally {
    conversations[entry.id].loading = false;
    renderReflectionBox(entry.id);
  }
}

async function continueReflection(entry, userMessage) {
  const convo = conversations[entry.id];
  convo.messages.push({ role: 'user', text: userMessage });
  convo.loading = true;
  renderReflectionBox(entry.id);

  try {
    const res = await fetch('/api/reflect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history: convo.history, message: userMessage })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Fehler');
    convo.history = data.history;
    convo.messages.push({ role: 'model', text: data.reply });
  } catch (err) {
    console.error(err);
    convo.messages.push({ role: 'model', text: 'Antwort konnte nicht geladen werden.' });
  } finally {
    convo.loading = false;
    renderReflectionBox(entry.id);
  }
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

  $('entriesList').addEventListener('click', (e) => {
    const reflectBtn = e.target.closest('.reflect-btn');
    if (reflectBtn) {
      const entry = entries.find((en) => en.id === reflectBtn.dataset.id);
      startReflection(entry);
      return;
    }
    const sendBtn = e.target.closest('.reflection-send');
    if (sendBtn) {
      sendFollowUp(sendBtn.closest('.reflection-box'));
    }
  });

  $('entriesList').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('reflection-input')) {
      e.preventDefault();
      sendFollowUp(e.target.closest('.reflection-box'));
    }
  });
}

function sendFollowUp(box) {
  const entryId = box.id.replace('reflection-', '');
  const entry = entries.find((en) => en.id === entryId);
  const input = box.querySelector('.reflection-input');
  const text = input.value.trim();
  if (!text) return;
  continueReflection(entry, text);
}

window.authReady.then((user) => {
  if (user) init();
});
