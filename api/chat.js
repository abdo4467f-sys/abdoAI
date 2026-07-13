export default async function handler(req, res) {
  // 1. إعدادات الـ CORS
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
      return res.status(500).json({ error: 'API key is missing' });
    }

    const body = req.body || {};
    const incomingMessages = body.messages || [];
    
    // استخراج النص إذا لم تكن هناك مصفوفة
    if (incomingMessages.length === 0) {
       let altText = body.message || body.prompt || body.text || 'مرحبا';
       incomingMessages.push({ role: 'user', content: altText });
    }

    let formattedContents = [];
    let systemText = "";

    // 2. أخذ آخر 5 رسائل فقط لتسريع الرد ومنع حدوث Timeout في Vercel (10 ثوانٍ)
    const recentMessages = incomingMessages.slice(-5);

    recentMessages.forEach(msg => {
      // عزل رسائل الـ System لأن جوجل تمتلك مساراً مستقلاً لها عكس OpenAI
      if (msg.role === 'system') {
        systemText += msg.content + "\n";
      } else {
        const mappedRole = msg.role === 'assistant' ? 'model' : 'user';
        
        // دمج الرسائل المتتالية من نفس النوع (جوجل ترفض رسالتين user وراء بعضها)
        const lastAdded = formattedContents[formattedContents.length - 1];
        if (lastAdded && lastAdded.role === mappedRole) {
            lastAdded.parts[0].text += "\n" + (msg.content || '');
        } else {
            formattedContents.push({
                role: mappedRole,
                parts: [{ text: msg.content || '' }]
            });
        }
      }
    });

    // جوجل تشترط دائماً أن تكون أول رسالة في المحادثة من نوع user
    if (formattedContents.length > 0 && formattedContents[0].role !== 'user') {
        formattedContents.shift();
    }

    // 3. استخدام النموذج 1.5 Flash الأسرع على الإطلاق لضمان رد فوري قبل مهلة Vercel
    const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: formattedContents
    };

    if (systemText) {
      requestBody.systemInstruction = {
        parts: [{ text: systemText.trim() }]
      };
    }

    const response = await fetch(googleUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error:', errorText);
      return res.status(response.status).json({ 
        error: 'API Error', 
        details: errorText,
        status: response.status 
      });
    }

    const data = await response.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'عذراً، لم أتمكن من توليد الرد.';

    // 4. إعادة الرد بصيغة متوافقة 100% مع واجهة تطبيق الـ APK
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
    console.error('Server Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
