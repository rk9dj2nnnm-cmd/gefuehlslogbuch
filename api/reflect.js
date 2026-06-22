module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { text, moods, intensity } = req.body || {};
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'Text fehlt.' });
    return;
  }

  const moodLabels = Array.isArray(moods) ? moods.map((m) => m.label).join(', ') : '';

  const prompt = `Du bist eine einfühlsame, ruhige Reflexionsbegleitung in einem Gefühlslogbuch.
Ein Mensch hat folgenden Eintrag geschrieben:

Gefühle: ${moodLabels || 'keine Angabe'}
Intensität: ${intensity || '?'}/5
Text: "${text}"

Schreibe eine kurze, warme Reflexion auf Deutsch (3-5 Sätze). Stelle am Ende eine
offene, nicht wertende Rückfrage. Gib keine Diagnosen und keine Ratschläge wie ein
Therapeut, sondern spiegle einfühlsam zurück, was du liest.`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server ist nicht richtig konfiguriert (kein API-Key).' });
    return;
  }

  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      }
    );

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error('Gemini-Fehler', errText);
      res.status(502).json({ error: 'KI-Reflexion ist fehlgeschlagen.' });
      return;
    }

    const data = await geminiResponse.json();
    const reflection = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Keine Antwort erhalten.';
    res.status(200).json({ reflection });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler bei der Reflexion.' });
  }
};
