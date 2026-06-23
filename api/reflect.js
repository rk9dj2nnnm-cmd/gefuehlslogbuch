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

    const prompt = `Du bist eine einfühlsame, ruhige Reflexionsbegleitung im Gefühlstaucher-Logbuch.
Hier sind die Einträge eines Menschen, älteste zuerst:

${list}

Schau dir das Gesamtbild an: Gibt es wiederkehrende Gefühle, Muster oder Veränderungen
über die Zeit? Schreibe eine kurze, warme Beobachtung auf Deutsch (4-6 Sätze) dazu, ohne
die einzelnen Gefühle nur aufzuzählen oder zu wiederholen. Keine Diagnosen und keine
Ratschläge wie ein Therapeut. Stelle am Ende eine einzige, konkrete Rückfrage, die näher
an die Ursache oder das Muster hinter dem Gesehenen herangeht (z.B. nach einem
wiederkehrenden Auslöser, einer bestimmten Lebenssituation oder dem, was sich die Person
gerade wünscht) — variiere die Art der Frage. Falls sich daraus ein Gespräch entwickelt,
bleib in dieser Rolle: zuhören, knapp und ohne Wiederholungen spiegeln, gezielt nachfragen.`;
    contents = [{ role: 'user', parts: [{ text: prompt }] }];
  } else {
    // Erste Reflexion zu einem einzelnen Eintrag
    if (!entry || typeof entry.text !== 'string') {
      res.status(400).json({ error: 'Eintrag fehlt.' });
      return;
    }
    const moodLabels = Array.isArray(entry.moods) ? entry.moods.map((m) => m.label).join(', ') : '';
    const prompt = `Du bist eine einfühlsame, ruhige Reflexionsbegleitung im Gefühlstaucher-Logbuch.
Ein Mensch hat folgenden Eintrag geschrieben:

Gefühle: ${moodLabels || 'keine Angabe'}
Intensität: ${entry.intensity || '?'}/5
Text: "${entry.text}"

Schreibe eine kurze, warme Reflexion auf Deutsch (3-5 Sätze). Wiederhole die genannten
Gefühle nicht wörtlich und fasse sie nicht nur zusammen, sondern geh konkret auf das ein,
was im Text steht. Stelle am Ende eine einzige, konkrete Rückfrage, die näher an die
Ursache oder das Bedürfnis hinter dem Gefühl herangeht (z.B. nach dem Auslöser, einer
bestimmten Situation, einem Gedanken dahinter oder dem, was die Person sich jetzt
wünscht) — variiere die Art der Frage, statt immer demselben Muster zu folgen. Gib
keine Diagnosen und keine Ratschläge wie ein Therapeut, sondern bleib neugierig und
nicht wertend. Falls sich daraus ein Gespräch entwickelt, bleib in dieser Rolle:
zuhören, knapp und ohne Wiederholungen spiegeln, gezielt nachfragen.`;
    contents = [{ role: 'user', parts: [{ text: prompt }] }];
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server ist nicht richtig konfiguriert (kein API-Key).' });
    return;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
  const body = JSON.stringify({ contents });

  try {
    let geminiResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });

    // Das kostenlose Gemini-Kontingent ist manchmal kurz überlastet (503) — ein Versuch reicht meist.
    if (geminiResponse.status === 503) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      geminiResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });
    }

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
