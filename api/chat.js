export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API Key missing' });

    const body = req.body;
    const messages = body.messages || [{ role: 'user', content: body.message || 'مرحبا' }];
    
    // تحويل الرسائل لتناسب بنية Gemini
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    // استخدام الرابط الصحيح والمحدث لنموذج 1.5 Flash
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('API Error:', data);
      return res.status(response.status).json({ error: 'API Error', details: data });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;

    return res.status(200).json({
      choices: [{ message: { role: 'assistant', content: reply } }]
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
