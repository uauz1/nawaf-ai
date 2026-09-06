const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, history = [], apiKey: userApiKey } = req.body || {};
  const apiKey = typeof userApiKey === 'string' && userApiKey.trim()
    ? userApiKey.trim()
    : process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(503).json({
      error: 'Gemini API key is not configured',
      code: 'MISSING_API_KEY'
    });
  }

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  const safeHistory = Array.isArray(history) ? history.slice(-12) : [];
  const contents = [
    ...safeHistory
      .filter((item) => item && typeof item.text === 'string')
      .map((item) => ({
        role: item.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: item.text.slice(0, 12000) }]
      })),
    { role: 'user', parts: [{ text: message.slice(0, 16000) }] }
  ];

  const systemInstruction = {
    parts: [{
      text: `أنت Nawaf AI، مساعد نواف الشخصي. تحدث بالعربية السعودية بشكل طبيعي ومباشر. اجعل الردود عملية وواضحة، واختصر عندما يكون الطلب بسيطًا. ساعد في التخطيط والبرمجة والأفكار والمشاريع. المشروعان الأساسيان هما مُعين وقدّها، لكن لا تفترض تفاصيل غير موجودة في رسالة المستخدم. لا تدّع تنفيذ شيء خارج قدراتك.`
    }]
  };

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1800
          }
        })
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error('Gemini API error', response.status, data?.error?.message || data);
      return res.status(response.status).json({
        error: data?.error?.message || 'Gemini request failed',
        code: 'GEMINI_ERROR'
      });
    }

    const text = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text || '')
      .join('')
      .trim();

    if (!text) {
      return res.status(502).json({ error: 'Empty response from Gemini', code: 'EMPTY_RESPONSE' });
    }

    return res.status(200).json({ text, model: MODEL });
  } catch (error) {
    console.error('Nawaf AI chat error', error);
    return res.status(500).json({ error: 'تعذر الاتصال بالذكاء الاصطناعي', code: 'SERVER_ERROR' });
  }
}
