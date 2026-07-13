export default async function handler(req, res) {
  // إعدادات الـ CORS لتسمح للواجهة بالاتصال بالسيرفر بدون مشاكل
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
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key is missing on the server' });
    }

    const body = req.body;
    
    // 1. تحويل صيغة الرسائل القادمة من الواجهة إلى الصيغة التي يفهمها نموذج Gemini الجديد
    const incomingMessages = body.messages || [];
    const formattedContents = incomingMessages.map(msg => {
      return {
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content || '' }]
      };
    });

    // 2. استخدام النموذج المستقر والأحدث حالياً gemini-3.5-flash لتجنب خطأ 404
    const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(googleUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: formattedContents
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error:', errorText);
      return res.status(response.status).json({ 
        error: 'Error from Gemini API', 
        details: errorText,
        status: response.status 
      });
    }

    const data = await response.json();
    
    // 3. استخراج النص الراجع من رد الذكاء الاصطناعي
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'لم أتمكن من الحصول على رد.';

    // 4. إرسال الرد بالصيغة المتوافقة تماماً مع الواجهة الأمامية الخاصة بك (OpenAI Format)
    return res.status(200).json({
      choices: [
        {
          message: {
            role: 'assistant',
            content: replyText
          }
        }
      ]
    });

  } catch (error) {
    console.error('Server Crash Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
