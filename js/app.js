let entries = [];
let selectedKeys = new Set(); // ausgewählte Grund- und/oder Unterkategorien
let openHistoryEntryId = null; // welcher ältere Eintrag aktuell aufgeklappt ist (immer nur einer)
let selectedIntensity = 3;
let easterEggShown = false;

function checkEasterEgg(text) {
  if (easterEggShown) return;
  if (text.toLowerCase().includes('schatzkiste')) {
    easterEggShown = true;
    const toast = $('easterEggToast');
    toast.textContent = '💎 Du hast eine Schatzkiste gefunden! Manchmal stecken die schönsten Funde in ganz normalen Worten.';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4500);
  }
}

function renderIntensityDots() {
  const el = $('intensityDots');
  el.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'intensity-dot intensity-dot-' + i + (i <= selectedIntensity ? ' filled' : '');
    dot.setAttribute('aria-label', `Intensität ${i} von 5`);
    dot.addEventListener('click', () => {
      selectedIntensity = i;
      renderIntensityDots();
    });
    el.appendChild(dot);
  }
}

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
const MAX_SUB_MOODS_PER_GROUP = 3;
let justSelectedKey = null; // löst beim Rendern einmalig den Auswahl-Effekt aus

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
    btn.className = 'mood-circle' + (isSelected ? ' selected' : '') + (group.key === justSelectedKey ? ' just-selected' : '');
    btn.dataset.mood = group.key;
    btn.style.setProperty('--mood-color', group.color);
    btn.setAttribute('aria-label', group.label);
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${group.icon}</svg>`;
    btn.disabled = limitReached && !isSelected;
    btn.addEventListener('click', () => toggleGroupSelection(group.key));
    mainEl.appendChild(btn);
  });
  justSelectedKey = null;

  const activeGroups = MOODS.filter(g => selectedKeys.has(g.key));
  captionEl.textContent = activeGroups.map((g) => g.label).join(' · ');
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

      const selectedSubCount = group.children.filter((c) => selectedKeys.has(c.key)).length;
      const subLimitReached = selectedSubCount >= MAX_SUB_MOODS_PER_GROUP;

      group.children.forEach(child => {
        const isChildSelected = selectedKeys.has(child.key);
        const childBtn = document.createElement('button');
        childBtn.className = 'mood-pill child' + (isChildSelected ? ' selected' : '');
        childBtn.style.setProperty('--mood-color', group.color);
        childBtn.textContent = child.label;
        childBtn.disabled = subLimitReached && !isChildSelected;
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
    justSelectedKey = key;
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
  $('weatherCard').style.display = entries.length === 0 ? 'none' : '';
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
      const isLatest = entries.length > 0 && e.id === entries[entries.length - 1].id;
      if (isLatest) {
        openHistoryEntryId = null;
        renderEntries();
        return;
      }
      openHistoryEntryId = openHistoryEntryId === e.id ? null : e.id;
      renderEntries();
      const target = document.getElementById('entry-' + e.id);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    strip.appendChild(bar);
  });
}

function entryHeadHtml(e) {
  // Nur Hauptgefühle anzeigen, Untergefühle bleiben gespeichert (für KI & Dashboard),
  // werden aber nicht extra als Chips angezeigt, damit der Kopf nicht überladen wirkt.
  const chips = (e.moods || []).filter((c) => MOODS.some((g) => g.label === c.label));
  const moodHtml = chips.map(c => `<span><span class="mood-dot" style="background:${c.color}"></span>${c.label}</span>`).join(' · ');
  return `
    <div class="entry-head">
      <span class="entry-mood">${moodHtml}</span>
      <span class="entry-date">${formatDate(e.created_at)}</span>
    </div>
    <p class="entry-text">${escapeHtml(e.text)}</p>
  `;
}

// Aktueller Eintrag: interaktive Reflexion (starten/weiterschreiben möglich)
function currentEntryInnerHtml(e) {
  return entryHeadHtml(e) + `
    <div class="reflection-box" id="reflection-${e.id}">
      <button class="ghost reflect-btn" data-id="${e.id}">🌊 Abtauchen</button>
    </div>
  `;
}

// Ältere Einträge: keine neue Reflexion mehr möglich, nur bestehender Verlauf lesbar
function historyEntryInnerHtml(e) {
  const convo = conversations[e.id];
  if (!convo) return entryHeadHtml(e);

  const messagesHtml = convo.messages
    .map((m) => `<p class="reflection-msg ${m.role}">${escapeHtml(m.text)}</p>`)
    .join('');

  return entryHeadHtml(e) + `<div class="reflection-box active readonly">${messagesHtml}</div>`;
}

function isToday(iso) {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function renderCurrentEntry() {
  const box = $('currentEntryBox');
  const heading = $('currentEntryHeading');
  if (entries.length === 0) {
    heading.textContent = 'Dein aktueller Eintrag';
    box.innerHTML = '<p class="empty-state">Noch keine Einträge. Dein erster Eintrag erscheint hier, sobald du ihn speicherst.</p>';
    $('newEntryBtn').classList.add('hint-pulse');
    return;
  }
  const e = entries[entries.length - 1];
  const hasEntryToday = isToday(e.created_at);
  heading.textContent = hasEntryToday ? 'Dein aktueller Eintrag' : 'Dein letzter Eintrag';
  box.innerHTML = currentEntryInnerHtml(e);
  renderReflectionBox(e.id);
  $('newEntryBtn').classList.toggle('hint-pulse', !hasEntryToday);
}

function renderEntries() {
  const list = $('entriesList');
  const currentHeading = $('currentEntryHeading');
  const currentBox = $('currentEntryBox');
  const olderEntries = entries.slice(0, -1); // alle außer dem aktuellsten Eintrag
  const open = olderEntries.find((e) => e.id === openHistoryEntryId);

  if (!open) {
    // Kein alter Eintrag aufgeklappt: aktuellen Eintrag normal zeigen.
    currentHeading.style.display = '';
    currentBox.style.display = '';
    list.innerHTML = (entries.length > 0 && olderEntries.length === 0)
      ? '<p class="empty-state">Noch keine älteren Einträge.</p>'
      : '';
    return;
  }

  // Ein alter Eintrag ist aufgeklappt: ersetzt den aktuellen Eintrag, statt zusätzlich daneben zu stehen.
  // Zurück geht über erneutes Antippen desselben oder eines anderen Balkens (z.B. des letzten).
  currentHeading.style.display = 'none';
  currentBox.style.display = 'none';

  list.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'entry';
  card.id = 'entry-' + open.id;
  card.innerHTML = historyEntryInnerHtml(open);
  list.appendChild(card);
}

/* ---------- KI-Reflexionsgespräch (Gemini über eigene Vercel-Function) ---------- */
const conversations = {}; // entry.id -> { messages: [{role, text}], history: [...Gemini-Contents], loading }

function renderReflectionBox(entryId) {
  const box = $('reflection-' + entryId);
  if (!box) return; // Eintrag ist eingeklappt, Reflexionsbox aktuell nicht im DOM
  const convo = conversations[entryId];

  box.classList.toggle('active', !!convo);

  if (!convo) {
    box.innerHTML = `<button class="ghost reflect-btn" data-id="${entryId}">🌊 Abtauchen</button>`;
    return;
  }

  const messagesHtml = convo.messages
    .map((m) => `<p class="reflection-msg ${m.role}">${escapeHtml(m.text)}</p>`)
    .join('');
  const loadingHtml = convo.loading ? '<p class="reflection-msg model loading">Taucht ab …</p>' : '';

  // Solange der erste Austausch nicht erfolgreich war, gibt es keinen gültigen
  // Gesprächsverlauf für eine Fortsetzung – dann nur ein Retry anbieten statt
  // eines Antwortfelds, das ohnehin nur einen Folgefehler produzieren würde.
  let actionHtml = '';
  if (!convo.loading) {
    actionHtml = convo.history.length > 0
      ? `<div class="reflection-input-row">
           <input type="text" class="reflection-input" placeholder="Antworten …" />
           <button class="ghost reflection-send">Senden</button>
         </div>`
      : `<button class="ghost reflect-btn" data-id="${entryId}">🌊 Nochmal versuchen</button>`;
  }

  box.innerHTML = messagesHtml + loadingHtml + actionHtml;
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
    conversations[entry.id].messages.push({ role: 'model', text: 'Konnte gerade nicht abtauchen. Versuch es nochmal.' });
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
  if (entries.length < 3) {
    const hint = $('overviewHint');
    hint.textContent = 'Du brauchst noch mindestens 3 Einträge, um das Gesamtbild zu sehen.';
    hint.style.color = '#E08585';
    hint.style.display = '';
    return;
  }
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
    conversations.overview.messages.push({ role: 'model', text: 'Konnte gerade nicht abtauchen. Versuch es nochmal.' });
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

/* ---------- Ansicht wechseln: Übersicht vs. fokussierter neuer Eintrag ---------- */
function showOverview() {
  $('overviewView').style.display = '';
  $('newEntryView').style.display = 'none';
  $('newEntryBtn').style.display = '';
}

function showNewEntryView() {
  openHistoryEntryId = null; // sonst könnte ein offener alter Eintrag nach dem Speichern den neuen verdecken
  $('overviewView').style.display = 'none';
  $('newEntryView').style.display = '';
  $('newEntryBtn').style.display = 'none';
}

/* ---------- Eintrag speichern ---------- */
async function saveEntry() {
  const text = $('entryText').value.trim();
  if (selectedKeys.size === 0 || !text) return;

  $('saveBtn').disabled = true;

  const { data, error } = await supabaseClient
    .from('entries')
    .insert({ moods: selectedMoodChips(), intensity: selectedIntensity, text })
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
  renderCurrentEntry();
  renderEntries();
  updateOverviewButton();
  renderDashboard();
  showOverview();
  startReflection(data);
}

function resetDraft() {
  $('entryText').value = '';
  easterEggShown = false;
  selectedIntensity = 3;
  renderIntensityDots();
  selectedKeys = new Set();
  renderMoodGroups();
  updateSky();
  updateButtons();
}

/* ---------- Dashboard: einfache Statistiken über alle Einträge ---------- */
function moodFrequency() {
  const counts = {};
  entries.forEach((e) => {
    (e.moods || []).forEach((c) => {
      const isMainGroup = MOODS.some((g) => g.label === c.label);
      if (isMainGroup) counts[c.label] = (counts[c.label] || 0) + 1;
    });
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function currentStreak() {
  if (entries.length === 0) return 0;
  const days = new Set(entries.map((e) => new Date(e.created_at).toDateString()));
  const cursor = new Date();
  if (!days.has(cursor.toDateString())) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(cursor.toDateString())) return 0;
  }
  let streak = 0;
  while (days.has(cursor.toDateString())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function renderDashboard() {
  const empty = $('dashboardEmpty');
  const content = $('dashboardContent');
  if (entries.length === 0) {
    empty.style.display = '';
    content.innerHTML = '';
    return;
  }
  empty.style.display = 'none';

  const streak = currentStreak();
  const freq = moodFrequency();
  const maxFreq = freq.length ? freq[0][1] : 1;

  const freqHtml = freq.slice(0, 5).map(([label, count]) => {
    const node = MOODS.find((g) => g.label === label);
    const color = node ? node.color : '#888';
    const pct = Math.round((count / maxFreq) * 100);
    return `
      <div class="dash-freq-row">
        <span class="dash-freq-label">${escapeHtml(label)}</span>
        <div class="dash-freq-bar"><div class="dash-freq-fill" style="width:${pct}%; background:${color};"></div></div>
        <span class="dash-freq-count">${count}</span>
      </div>`;
  }).join('');

  content.innerHTML = `
    <div class="dash-stats-row">
      <div class="dash-stat"><strong>${entries.length}</strong><span>Einträge insgesamt</span></div>
      <div class="dash-stat"><strong>${streak}</strong><span>${streak === 1 ? 'Tag in Folge' : 'Tage in Folge'}</span></div>
    </div>
    ${freqHtml ? `<div class="dash-section-label">Häufigste Gefühle</div><div class="dash-freq-list">${freqHtml}</div>` : ''}
  `;
}

function updateOverviewButton() {
  const ready = entries.length >= 3;
  const hint = $('overviewHint');
  hint.style.color = '';
  hint.textContent = 'Ab 3 Einträgen verfügbar – schau dir an, ob sich Muster über die Zeit zeigen.';
  hint.style.display = ready ? 'none' : '';
}

async function init() {
  $('todayLabel').textContent = todayLabel();
  createSkyBlobs();
  renderMoodGroups();
  renderIntensityDots();
  entries = await loadEntries();
  renderStrip();
  renderCurrentEntry();
  renderEntries();
  updateOverviewButton();
  renderDashboard();

  $('entryText').addEventListener('input', () => {
    updateButtons();
    checkEasterEgg($('entryText').value);
  });
  $('saveBtn').addEventListener('click', saveEntry);
  $('overviewBtn').addEventListener('click', startOverviewReflection);
  $('newEntryBtn').addEventListener('click', showNewEntryView);
  $('cancelEntryBtn').addEventListener('click', showOverview);

  const main = document.querySelector('.wrap');

  main.addEventListener('click', (e) => {
    const reflectBtn = e.target.closest('.reflect-btn');
    if (reflectBtn) {
      if (reflectBtn.dataset.id === 'overview') {
        startOverviewReflection();
      } else {
        const entry = entries.find((en) => en.id === reflectBtn.dataset.id);
        startReflection(entry);
      }
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
