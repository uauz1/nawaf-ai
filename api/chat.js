const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const FALLBACK_MODELS = ['gemini-3.7-flash', 'gemini-3.5-flash-lite'];

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

  const models = [...new Set([PRIMARY_MODEL, ...FALLBACK_MODELS])];
  let lastError = null;

  try {
    for (const model of models) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
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

      if (response.ok) {
        const text = data?.candidates?.[0]?.content?.parts
          ?.map((part) => part?.text || '')
          .join('')
          .trim();

        if (!text) {
          lastError = { status: 502, message: 'Empty response from Gemini' };
          continue;
        }

        return res.status(200).json({ text, model });
      }

      const errorMessage = data?.error?.message || 'Gemini request failed';
      lastError = { status: response.status, message: errorMessage };
      console.error('Gemini API error', model, response.status, errorMessage);

      const temporaryCapacityIssue = response.status === 429 || response.status === 503 || /high demand|overloaded|capacity|temporar/i.test(errorMessage);
      if (temporaryCapacityIssue) continue;

      return res.status(response.status).json({
        error: errorMessage,
        code: 'GEMINI_ERROR'
      });
    }

    return res.status(lastError?.status || 503).json({
      error: 'نماذج Gemini عليها ضغط مؤقت حاليًا. جرّب مرة ثانية بعد قليل.',
      code: 'GEMINI_BUSY'
    });
  } catch (error) {
    console.error('Nawaf AI chat error', error);
    return res.status(500).json({ error: 'تعذر الاتصال بالذكاء الاصطناعي', code: 'SERVER_ERROR' });
  }
}
