// Hierarchisches Gefühlsmodell: Grundgefühle mit feineren Unterkategorien.
// Jede Kategorie (Grundgefühl ODER Unterkategorie) ist einzeln wählbar,
// Mehrfachauswahl über Gruppen hinweg ist erlaubt.

const MOODS = [
  {
    key: 'freude',
    label: 'Freude',
    color: '#E8A33D',
    icon: '<path d="M6 15 L12 9 L18 15"/>',
    children: [
      { key: 'begeisterung', label: 'Begeisterung' },
      { key: 'dankbarkeit', label: 'Dankbarkeit' },
      { key: 'zufriedenheit', label: 'Zufriedenheit' },
      { key: 'stolz', label: 'Stolz' },
      { key: 'verliebtheit', label: 'Verliebtheit' },
    ],
  },
  {
    key: 'traurigkeit',
    label: 'Traurigkeit',
    color: '#6B7FE0',
    icon: '<path d="M6 9 L12 15 L18 9"/>',
    children: [
      { key: 'enttaeuschung', label: 'Enttäuschung' },
      { key: 'einsamkeit', label: 'Einsamkeit' },
      { key: 'trauer', label: 'Trauer' },
      { key: 'niedergeschlagenheit', label: 'Niedergeschlagenheit' },
    ],
  },
  {
    key: 'wut',
    label: 'Wut',
    color: '#C1604A',
    icon: '<path d="M13 4 L8 13 H12 L10 20 L17 10 H12 L13 4 Z" fill="currentColor" stroke="none"/>',
    children: [
      { key: 'frustration', label: 'Frustration' },
      { key: 'genervtheit', label: 'Genervtheit' },
      { key: 'empoerung', label: 'Empörung' },
      { key: 'eifersucht', label: 'Eifersucht' },
    ],
  },
  {
    key: 'angst',
    label: 'Angst',
    color: '#9A86C9',
    icon: '<path d="M4 12 Q7 6 10 12 T16 12 T22 12"/>',
    children: [
      { key: 'sorge', label: 'Sorge' },
      { key: 'nervositaet', label: 'Nervosität' },
      { key: 'ueberforderung', label: 'Überforderung' },
      { key: 'unsicherheit', label: 'Unsicherheit' },
    ],
  },
  {
    key: 'ekel',
    label: 'Ekel',
    color: '#7C9A5C',
    icon: '<path d="M5 9 L10 15 L14 9 L19 15"/>',
    children: [
      { key: 'abneigung', label: 'Abneigung' },
      { key: 'widerwillen', label: 'Widerwillen' },
      { key: 'selbstekel', label: 'Selbstekel' },
    ],
  },
  {
    key: 'ueberraschung',
    label: 'Überraschung',
    color: '#D9C45C',
    icon: '<path d="M12 4 V20 M5 8 L19 16 M19 8 L5 16"/>',
    children: [
      { key: 'verwirrung', label: 'Verwirrung' },
      { key: 'erstaunen', label: 'Erstaunen' },
      { key: 'schock', label: 'Schock' },
    ],
  },
  {
    key: 'scham',
    label: 'Scham',
    color: '#B5708C',
    icon: '<path d="M6 8 Q12 18 18 8"/>',
    children: [
      { key: 'verlegenheit', label: 'Verlegenheit' },
      { key: 'schuldgefuehl', label: 'Schuldgefühl' },
      { key: 'peinlichkeit', label: 'Peinlichkeit' },
      { key: 'unzulaenglichkeit', label: 'Unzulänglichkeit' },
    ],
  },
  {
    key: 'leere',
    label: 'Leere',
    color: '#9C968A',
    icon: '<circle cx="12" cy="12" r="7"/>',
    children: [
      { key: 'erschoepfung', label: 'Erschöpfung' },
      { key: 'gleichgueltigkeit', label: 'Gleichgültigkeit' },
      { key: 'sinnlosigkeit', label: 'Sinnlosigkeit' },
      { key: 'taubheit', label: 'Taubheit' },
    ],
  },
];

// Schnelles Nachschlagen: liefert { group, node } für einen Key,
// egal ob es ein Grundgefühl oder eine Unterkategorie ist.
function findMoodNode(key) {
  for (const group of MOODS) {
    if (group.key === key) return { group, node: group };
    const child = group.children.find(c => c.key === key);
    if (child) return { group, node: child };
  }
  return null;
}
