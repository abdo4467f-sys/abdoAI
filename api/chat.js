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

  // 🔍 طباعة بيانات الطلب القادم فوراً في سجلات Vercel للتشخيص
  console.log("=== 📥 طلب جديد واصل إلى السيرفر ===");
  console.log("نوع الـ body المستلم عينات:", typeof req.body);
  console.log("محتوى الـ body بالكامل:", JSON.stringify(req.body));
  console.log("الـ Headers المرسلة من التطبيق:", JSON.stringify(req.headers));

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("❌ خطأ: مفتاح GEMINI_API_KEY غير موجود أو لم يتم قراءته من إعدادات Vercel!");
      return res.status(500).json({ error: 'مفتاح GEMINI_API_KEY غير معرف في إعدادات Vercel' });
    }

    let dataBody = req.body;
    
    // تحويل النص إلى كائن JSON إذا كان واصلاً كنص خام
    if (typeof dataBody === 'string') {
      try {
        dataBody = JSON.parse(dataBody);
        console.log("🔄 تم عمل Parse للـ body بنجاح كـ JSON string");
      } catch (e) {
        console.log("⚠️ فشل تحويل الـ body كـ JSON، تم اعتباره نصاً خاماً");
      }
    }

    let userText = '';
    
    if (dataBody && typeof dataBody === 'object') {
      // محاولة استخراج النص من مصفوفة messages (صيغة OpenAI)
      if (Array.isArray(dataBody.messages) && dataBody.messages.length > 0) {
        const lastUser = [...dataBody.messages].reverse().find(m => m.role === "user");
        userText = lastUser?.content?.trim() || "";
        console.log("✅ تم استخراج النص بنجاح من مصفوفة messages:", userText);
      }
      
      // حل احتياطي في حال تم إرسال الطلب بصيغة حقول فردية
      if (!userText) {
        userText = dataBody.message || 
                   dataBody.prompt || 
                   dataBody.text || 
                   dataBody.input ||
                   Object.values(dataBody).find(v => typeof v === 'string') || '';
        console.log("ℹ️ تم سحب النص من الحقول الفردية الاحتياطية:", userText);
      }
    }

    userText = userText.trim();

    if (!userText) {
      console.error("❌ خطأ: لم يتم العثور على أي نص للرسالة، متغير userText فارغ!");
      return res.status(400).json({ 
        error: 'لم يعثر السيرفر على نص الرسالة داخل مصفوفة messages القادمة من التطبيق.' 
      });
    }

    console.log("🚀 جاري الاتصال بـ Google Gemini API...");
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
      console.error("❌ خطأ راجع من سيرفر جوجل Gemini مباشرة:", JSON.stringify(data));
      return res.status(response.status).json({ error: data.error?.message || 'خطأ في الاستجابة من خادم جوجل' });
    }

    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 'لم أتمكن من توليد رد.';
    console.log("🎉 تم استقبال الرد من Gemini بنجاح، جاري إرساله للواجهة...");
    
    // إعادة تغليف الرد ليطابق الهيكلية المتوقعة في الواجهة تماماً
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
    console.error("❌ حدث خطأ داخلي غير متوقع في الكود:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
