export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // كود ذكي: يقرأ الرسالة سواء كانت باسم message أو prompt أو text لضمان التوافق التام
    const userText = req.body.message || req.body.prompt || req.body.text;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'مفتاح الـ API الخاص بـ Gemini غير معرف في Vercel' });
    }

    if (!userText) {
      return res.status(400).json({ error: 'لم يصل أي نص من الواجهة، تأكد من مسميات الإرسال.' });
    }

    // الاتصال المباشر بنموذج Gemini 1.5 Flash
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: userText }]
        }]
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'خطأ من خادم جـوجـل' });
    }

    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 'لم أتمكن من توليد رد، حاول مجدداً.';
    
    // إرسال الرد بجميع المسميات الممكنة ليفهمها تطبيق الـ APK فوراً
    return res.status(200).json({ 
      reply: aiResponse,
      response: aiResponse,
      text: aiResponse
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
