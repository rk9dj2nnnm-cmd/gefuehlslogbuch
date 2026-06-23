module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { code } = req.body || {};
  const expected = process.env.ACCESS_CODE;

  if (!expected) {
    res.status(500).json({ error: 'Server ist nicht richtig konfiguriert (kein Zugangscode gesetzt).' });
    return;
  }

  const valid = typeof code === 'string' && code.trim().toUpperCase() === expected.toUpperCase();
  res.status(200).json({ valid });
};
