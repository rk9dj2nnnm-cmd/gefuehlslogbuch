module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { entry, entries, history, message } = req.body || {};

  let contents;

  if (Array.isArray(history) && history.length > 0) {
    // Fortsetzung eines bestehenden Gesprächs (egal ob Einzel- oder Gesamtreflexion)
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Nachricht fehlt.' });
      return;
    }
    contents = [...history, { role: 'user', parts: [{ text: message }] }];
  } else if (Array.isArray(entries) && entries.length > 0) {
    // Gesamtreflexion über mehrere Einträge hinweg
    const list = entries
      .slice(-30)
      .map((e, i) => {
        const moodLabels = Array.isArray(e.moods) ? e.moods.map((m) => m.label).join(', ') : '';
        const date = e.created_at
          ? new Date(e.created_at).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
          : '?';
        return `${i + 1}. ${date} – Gefühle: ${moodLabels || 'keine Angabe'}, Intensität: ${e.intensity || '?'}/5: "${e.text}"`;
      })
      .join('\n');

    const prompt = `Du bist eine einfühlsame, ruhige Reflexionsbegleitung in einem Gefühlslogbuch.
Hier sind die Einträge eines Menschen, älteste zuerst:

${list}

Schau dir das Gesamtbild an: Gibt es wiederkehrende Gefühle, Muster oder Veränderungen
über die Zeit? Schreibe eine kurze, warme Beobachtung auf Deutsch (4-6 Sätze) dazu.
Keine Diagnosen und keine Ratschläge wie ein Therapeut, sondern spiegle einfühlsam
zurück, was du siehst. Stelle am Ende eine offene, nicht wertende Rückfrage. Falls
sich daraus ein Gespräch entwickelt, bleib in dieser Rolle: zuhören, einfühlsam
spiegeln, behutsam nachfragen.`;
    contents = [{ role: 'user', parts: [{ text: prompt }] }];
  } else {
    // Erste Reflexion zu einem einzelnen Eintrag
    if (!entry || typeof entry.text !== 'string') {
      res.status(400).json({ error: 'Eintrag fehlt.' });
      return;
    }
    const moodLabels = Array.isArray(entry.moods) ? entry.moods.map((m) => m.label).join(', ') : '';
    const prompt = `Du bist eine einfühlsame, ruhige Reflexionsbegleitung in einem Gefühlslogbuch.
Ein Mensch hat folgenden Eintrag geschrieben:

Gefühle: ${moodLabels || 'keine Angabe'}
Intensität: ${entry.intensity || '?'}/5
Text: "${entry.text}"

Schreibe eine kurze, warme Reflexion auf Deutsch (3-5 Sätze). Stelle am Ende eine
offene, nicht wertende Rückfrage. Gib keine Diagnosen und keine Ratschläge wie ein
Therapeut, sondern spiegle einfühlsam zurück, was du liest. Falls sich daraus ein
Gespräch entwickelt, bleib in dieser Rolle: zuhören, einfühlsam spiegeln, behutsam
nachfragen.`;
    contents = [{ role: 'user', parts: [{ text: prompt }] }];
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server ist nicht richtig konfiguriert (kein API-Key).' });
    return;
  }

  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
      }
    );

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error('Gemini-Fehler', errText);
      res.status(502).json({ error: 'KI-Reflexion ist fehlgeschlagen.' });
      return;
    }

    const data = await geminiResponse.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Keine Antwort erhalten.';
    const updatedHistory = [...contents, { role: 'model', parts: [{ text: reply }] }];
    res.status(200).json({ reply, history: updatedHistory });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler bei der Reflexion.' });
  }
};
