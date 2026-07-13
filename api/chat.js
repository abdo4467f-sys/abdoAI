export default async function handler(req, res) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    console.log("--- بدء فحص الاتصال ---");
    console.log("هل مفتاح API موجود؟", !!apiKey);
    
    if (!apiKey) return res.status(500).json({ error: "API Key not found in Vercel" });

    const body = req.body;
    console.log("جسم الطلب (Body) المستلم:", JSON.stringify(body));

    const payload = {
      contents: [{ role: "user", parts: [{ text: body.message || "مرحبا" }] }]
    };

    console.log("البيانات المرسلة لجوجل:", JSON.stringify(payload));

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log("رد جوجل (Google Response):", JSON.stringify(data));

    if (!response.ok) return res.status(response.status).json({ error: "API Error", details: data });

    return res.status(200).json({ reply: data.candidates[0].content.parts[0].text });

  } catch (error) {
    console.error("خطأ كارثي:", error);
    return res.status(500).json({ error: error.message });
  }
}
