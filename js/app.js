let entries = [];
let selectedKeys = new Set(); // ausgewählte Grund- und/oder Unterkategorien
let expandedEntryIds = new Set(); // welche Einträge voll ausgeklappt sind
const RECENT_EXPANDED_COUNT = 4;

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
    blob.style.background = `radial-gradient(circle at ${x}% ${y}%, ${group.color}, transparent 70%)`;
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

/* ---------- Mood-Auswahl (Hauptgefühle als Icon-Kreise, Unterkategorien als Verfeinerung) ---------- */
const MAX_MAIN_MOODS = 3;

function renderMoodGroups() {
  const mainEl = $('moodMainPills');
  const captionEl = $('moodCaption');
  const refineEl = $('moodRefine');
  mainEl.innerHTML = '';
  refineEl.innerHTML = '';

  const selectedMainCount = MOODS.filter(g => selectedKeys.has(g.key)).length;
  const limitReached = selectedMainCount >= MAX_MAIN_MOODS;

  MOODS.forEach(group => {
    const isSelected = selectedKeys.has(group.key);
    const btn = document.createElement('button');
    btn.className = 'mood-circle' + (isSelected ? ' selected' : '');
    btn.style.setProperty('--mood-color', group.color);
    btn.setAttribute('aria-label', group.label);
    btn.textContent = group.emoji;
    btn.disabled = limitReached && !isSelected;
    btn.addEventListener('click', () => toggleGroupSelection(group.key));
    mainEl.appendChild(btn);
  });

  const activeGroups = MOODS.filter(g => selectedKeys.has(g.key));
  captionEl.textContent = activeGroups.length > 0
    ? activeGroups.map((g) => g.label).join(' · ')
    : 'Tippe auf ein Gefühl';
  refineEl.classList.toggle('open', activeGroups.length > 0);

  if (activeGroups.length > 0) {
    const heading = document.createElement('div');
    heading.className = 'refine-heading';
    heading.textContent = 'Genauer? (optional)';
    refineEl.appendChild(heading);

    activeGroups.forEach(group => {
      const row = document.createElement('div');
      row.className = 'refine-group';

      const label = document.createElement('span');
      label.className = 'refine-group-label';
      label.innerHTML = `<span class="mood-dot" style="background:${group.color}"></span>${group.label}`;
      row.appendChild(label);

      group.children.forEach(child => {
        const childBtn = document.createElement('button');
        childBtn.className = 'mood-pill child' + (selectedKeys.has(child.key) ? ' selected' : '');
        childBtn.style.setProperty('--mood-color', group.color);
        childBtn.textContent = child.label;
        childBtn.addEventListener('click', () => toggleSelection(child.key));
        row.appendChild(childBtn);
      });

      refineEl.appendChild(row);
    });
  }
}

function toggleGroupSelection(key) {
  if (selectedKeys.has(key)) {
    selectedKeys.delete(key);
    // Verfeinerungsliste verschwindet mit der Gruppe, also auch deren Unterkategorien abwählen.
    const group = MOODS.find(g => g.key === key);
    group.children.forEach(c => selectedKeys.delete(c.key));
  } else {
    const selectedMainCount = MOODS.filter(g => selectedKeys.has(g.key)).length;
    if (selectedMainCount >= MAX_MAIN_MOODS) return;
    selectedKeys.add(key);
  }
  renderMoodGroups();
  updateSky();
  updateButtons();
}

function toggleSelection(key) {
  if (selectedKeys.has(key)) selectedKeys.delete(key);
  else selectedKeys.add(key);
  renderMoodGroups();
  updateSky();
  updateButtons();
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

  data.forEach((e) => {
    if (e.reflection && Array.isArray(e.reflection.messages) && e.reflection.messages.length > 0) {
      conversations[e.id] = {
        messages: e.reflection.messages,
        history: e.reflection.history || [],
        loading: false
      };
    }
  });

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
      expandedEntryIds.add(e.id);
      renderEntries();
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

  const visible = [...entries].reverse().filter((e) => expandedEntryIds.has(e.id));

  if (visible.length === 0) {
    list.innerHTML = '<p class="empty-state">Tipp auf einen Balken im Emotionswetter oben, um einen Eintrag zu sehen.</p>';
    return;
  }

  list.innerHTML = '';
  visible.forEach((e) => {
    const chips = e.moods || [];
    const card = document.createElement('div');
    card.className = 'entry';
    card.id = 'entry-' + e.id;

    const moodHtml = chips.map(c => `<span><span class="mood-dot" style="background:${c.color}"></span>${c.label}</span>`).join(' · ');

    card.innerHTML = `
      <div class="entry-head">
        <span class="entry-mood">${moodHtml}</span>
        <span class="entry-date">${formatDate(e.created_at)}</span>
      </div>
      <p class="entry-text">${escapeHtml(e.text)}</p>
      <button class="ghost entry-toggle" data-id="${e.id}">▾ Ausblenden</button>
      <div class="reflection-box" id="reflection-${e.id}">
        <button class="ghost reflect-btn" data-id="${e.id}">🌊 Auf den Grund gehen</button>
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
  if (!box) return; // Eintrag ist eingeklappt, Reflexionsbox aktuell nicht im DOM
  const convo = conversations[entryId];

  box.classList.toggle('active', !!convo);

  if (!convo) {
    box.innerHTML = `<button class="ghost reflect-btn" data-id="${entryId}">🌊 Auf den Grund gehen</button>`;
    return;
  }

  const messagesHtml = convo.messages
    .map((m) => `<p class="reflection-msg ${m.role}">${escapeHtml(m.text)}</p>`)
    .join('');
  const loadingHtml = convo.loading ? '<p class="reflection-msg model loading">Taucht ab …</p>' : '';
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
    conversations[entry.id].messages.push({ role: 'model', text: 'Konnte gerade nicht auf den Grund gehen. Versuch es nochmal.' });
  } finally {
    conversations[entry.id].loading = false;
    renderReflectionBox(entry.id);
    persistReflection(entry.id);
  }
}

async function persistReflection(entryId) {
  const convo = conversations[entryId];
  const { error } = await supabaseClient
    .from('entries')
    .update({ reflection: { messages: convo.messages, history: convo.history } })
    .eq('id', entryId);
  if (error) console.error('Reflexion konnte nicht gespeichert werden', error);
}

async function startOverviewReflection() {
  conversations.overview = { messages: [], history: [], loading: true };
  renderReflectionBox('overview');

  try {
    const res = await fetch('/api/reflect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entries: entries.map((e) => ({ text: e.text, moods: e.moods, intensity: e.intensity, created_at: e.created_at }))
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Fehler');
    conversations.overview.history = data.history;
    conversations.overview.messages.push({ role: 'model', text: data.reply });
  } catch (err) {
    console.error(err);
    conversations.overview.messages.push({ role: 'model', text: 'Konnte gerade nicht auf den Grund gehen. Versuch es nochmal.' });
  } finally {
    conversations.overview.loading = false;
    renderReflectionBox('overview');
  }
}

async function continueReflection(entryId, userMessage) {
  const convo = conversations[entryId];
  convo.messages.push({ role: 'user', text: userMessage });
  convo.loading = true;
  renderReflectionBox(entryId);

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
    renderReflectionBox(entryId);
    if (entryId !== 'overview') persistReflection(entryId);
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
  expandedEntryIds.add(data.id);
  resetDraft();
  renderStrip();
  renderEntries();
  updateOverviewButton();
  startReflection(data);
}

function resetDraft() {
  $('entryText').value = '';
  $('intensity').value = 3;
  selectedKeys = new Set();
  renderMoodGroups();
  updateSky();
  updateButtons();
}

function updateOverviewButton() {
  const ready = entries.length >= 3;
  $('overviewBtn').disabled = !ready;
  $('overviewHint').style.display = ready ? 'none' : '';
}

async function init() {
  $('todayLabel').textContent = todayLabel();
  createSkyBlobs();
  renderMoodGroups();
  entries = await loadEntries();
  entries.slice(-RECENT_EXPANDED_COUNT).forEach((e) => expandedEntryIds.add(e.id));
  renderStrip();
  renderEntries();
  updateOverviewButton();

  $('entryText').addEventListener('input', updateButtons);
  $('saveBtn').addEventListener('click', saveEntry);
  $('overviewBtn').addEventListener('click', startOverviewReflection);

  const main = document.querySelector('.wrap');

  main.addEventListener('click', (e) => {
    const reflectBtn = e.target.closest('.reflect-btn');
    if (reflectBtn) {
      const entry = entries.find((en) => en.id === reflectBtn.dataset.id);
      startReflection(entry);
      return;
    }
    const entryToggle = e.target.closest('.entry-toggle');
    if (entryToggle) {
      const id = entryToggle.dataset.id;
      if (expandedEntryIds.has(id)) expandedEntryIds.delete(id);
      else expandedEntryIds.add(id);
      renderEntries();
      return;
    }
    const sendBtn = e.target.closest('.reflection-send');
    if (sendBtn) {
      sendFollowUp(sendBtn.closest('.reflection-box'));
    }
  });

  main.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('reflection-input')) {
      e.preventDefault();
      sendFollowUp(e.target.closest('.reflection-box'));
    }
  });
}

function sendFollowUp(box) {
  const entryId = box.id.replace('reflection-', '');
  const input = box.querySelector('.reflection-input');
  const text = input.value.trim();
  if (!text) return;
  continueReflection(entryId, text);
}

window.authReady.then((user) => {
  if (user) init();
});
