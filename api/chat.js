export default async function handler(req, res) {
  // إعدادات الاتصال (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    // 1. فحص وجود مفتاح API
    const apiKey = process.env.GEMINI_API_KEY;
    console.log("STEP 1: API Key Check -> " + (apiKey ? "Found" : "Missing"));

    if (!apiKey) {
      return res.status(500).json({ error: "API Key is missing in environment variables" });
    }

    // 2. فحص الرسالة المستقبلة
    const { message } = req.body;
    console.log("STEP 2: Message received -> " + message);

    // 3. الاتصال بجوجل
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: message }] }]
      })
    });

    const data = await response.json();
    console.log("STEP 3: Google Response Status -> " + response.status);

    // 4. إرجاع النتيجة أو الخطأ
    if (!response.ok) {
      console.log("STEP 4: Error Details -> ", data);
      return res.status(response.status).json({ error: "Google API Error", details: data });
    }

    return res.status(200).json({ reply: data.candidates[0].content.parts[0].text });

  } catch (error) {
    console.log("STEP 4: System Error -> " + error.message);
    return res.status(500).json({ error: error.message });
  }
}
