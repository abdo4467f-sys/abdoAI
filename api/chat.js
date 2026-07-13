export default async function handler(req, res) {
  // إعدادات الـ CORS للسماح للتطبيق بالاتصال دون قيود
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
      return res.status(500).json({ error: 'مفتاح GEMINI_API_KEY غير معرف في إعدادات Vercel' });
    }

    let dataBody = req.body;
    
    // 1. التعامل الذكي مع النصوص الخام إذا لم يتم إرسالها كـ JSON جاهز
    if (typeof dataBody === 'string') {
      try {
        dataBody = JSON.parse(dataBody);
      } catch (e) {
        // إذا فشل التحويل، فهذا يعني أن التطبيق يرسل الرسالة كنص عادي مباشر في الـ body
        dataBody = { rawText: dataBody };
      }
    }

    // 2. استخراج النص بجميع المسميات المحتملة، أو سحب أول نص متوفر في الطلب
    let userText = '';
    if (dataBody && typeof dataBody === 'object') {
      userText = dataBody.message || 
                 dataBody.prompt || 
                 dataBody.text || 
                 dataBody.rawText || 
                 dataBody.input ||
                 Object.values(dataBody).find(v => typeof v === 'string') || '';
    }

    userText = userText.trim();

    // إذا استمر عدم وجود نص بعد كل هذه المحاولات
    if (!userText) {
      return res.status(400).json({ 
        error: 'السيرفر استقبل الطلب بنجاح، لكن لم يعثر على أي نص للرسالة داخل البيانات المرسلة من التطبيق.' 
      });
    }

    // 3. تمرير النص النظيف الآن بنجاح إلى جوجل
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
      return res.status(response.status).json({ error: data.error?.message || 'خطأ في الاستجابة من خادم جوجل' });
    }

    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 'لم أتمكن من توليد رد.';
    
    // إرسال الرد بكل المسميات الممكنة لتطابق كود تطبيقك تماماً
    return res.status(200).json({ 
      reply: aiResponse,
      response: aiResponse,
      text: aiResponse
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
