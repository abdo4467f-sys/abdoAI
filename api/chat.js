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
    
    if (typeof dataBody === 'string') {
      try {
        dataBody = JSON.parse(dataBody);
      } catch (e) {
        // إذا كان النص قادماً كـ string خام
      }
    }

    let userText = '';
    
    if (dataBody && typeof dataBody === 'object') {
      // الحل العبقري: استخراج آخر رسالة للمستخدم من مصفوفة المحادثة (OpenAI Format)
      if (Array.isArray(dataBody.messages) && dataBody.messages.length > 0) {
        const lastUser = [...dataBody.messages].reverse().find(m => m.role === "user");
        userText = lastUser?.content?.trim() || "";
      }
      
      // حل احتياطي في حال تم إرسال الطلب بصيغة حقول فردية مستقبلاً
      if (!userText) {
        userText = dataBody.message || 
                   dataBody.prompt || 
                   dataBody.text || 
                   dataBody.input ||
                   Object.values(dataBody).find(v => typeof v === 'string') || '';
      }
    }

    userText = userText.trim();

    if (!userText) {
      return res.status(400).json({ 
        error: 'لم يعثر السيرفر على نص الرسالة داخل مصفوفة messages القادمة من التطبيق.' 
      });
    }

    // تمرير النص النظيف إلى خوادم جوجل Gemini 1.5 Flash
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
    
    // الحل العبقري الثاني: إعادة تغليف رد Gemini ليطابق تماماً هيكلة OpenAI التي تنتظرها الواجهة
    return res.status(200).json({ 
      choices: [
        { 
          message: { 
            role: "assistant",
            content: aiResponse 
          } 
        }
      ]
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
