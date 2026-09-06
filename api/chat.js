const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const FALLBACK_MODELS = ['gemini-2.5-flash-lite'];

function getRiyadhNow() {
  const now = new Date();
  const date = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    timeZone: 'Asia/Riyadh',
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  }).format(now);
  const time = new Intl.DateTimeFormat('ar-SA', {
    timeZone: 'Asia/Riyadh', hour: 'numeric', minute: '2-digit', hour12: true
  }).format(now);
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);
  return { date, time, iso };
}

function isDirectDateTimeQuestion(message) {
  const text = String(message || '').trim();
  const asksDate = /(وش|ايش|إيش|ما هو|ماهي|كم).*(التاريخ|تاريخ اليوم)|تاريخ اليوم|اليوم كم|وش اليوم|اي يوم|أي يوم/i.test(text);
  const asksTime = /(وش|ايش|إيش|كم).*(الوقت|الساعة)|كم الساعة|وش الوقت|الوقت الحين|الساعة كم/i.test(text);
  return { asksDate, asksTime };
}

function quickLocalReply(message, riyadh) {
  const { asksDate, asksTime } = isDirectDateTimeQuestion(message);
  if (asksDate || asksTime) {
    if (asksDate && asksTime) return `اليوم ${riyadh.date}، والوقت الآن ${riyadh.time} بتوقيت الرياض.`;
    if (asksDate) return `اليوم ${riyadh.date}.`;
    return `الوقت الآن ${riyadh.time} بتوقيت الرياض.`;
  }
  return '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, history = [], apiKey: userApiKey } = req.body || {};
  if (!message || typeof message !== 'string') return res.status(400).json({ error: 'Message is required' });

  const riyadh = getRiyadhNow();
  const localReply = quickLocalReply(message, riyadh);
  if (localReply) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.status(200).json({ text: localReply, model: 'system-clock', riyadhDate: riyadh.iso });
  }

  const apiKey = typeof userApiKey === 'string' && userApiKey.trim()
    ? userApiKey.trim()
    : process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Gemini API key is not configured', code: 'MISSING_API_KEY' });

  // Keep only the recent useful context. This cuts request size and improves voice latency.
  const rawHistory = Array.isArray(history) ? history.slice(-10) : [];
  const safeHistory = rawHistory.filter((item, index) => {
    if (!item || typeof item.text !== 'string') return false;
    const isLast = index === rawHistory.length - 1;
    return !(isLast && item.role === 'user' && item.text.trim() === message.trim());
  });

  const contents = [
    ...safeHistory.map(item => ({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: item.text.slice(0, 6000) }]
    })),
    { role: 'user', parts: [{ text: message.slice(0, 10000) }] }
  ];

  const systemInstruction = { parts: [{ text: `أنت Nawaf AI، مساعد نواف الشخصي. تحدث بسعودي طبيعي، ذكي، مباشر وسريع.

الوقت الحالي المؤكد في السعودية (Asia/Riyadh): ${riyadh.date}، الساعة ${riyadh.time}. التاريخ الميلادي الرقمي: ${riyadh.iso}. لا تخمّن التاريخ أو الوقت أبدًا.

المشروعان الأساسيان: مُعين وقدّها. افهم السياق واربط الرسائل السابقة ببعضها.

قواعد مهمة:
- في المحادثة العادية والصوتية: ابدأ بالجواب مباشرة واجعل الرد غالبًا جملة أو جملتين فقط، إلا إذا طلب نواف شرحًا أو تفاصيل.
- لا تكرر السؤال ولا مقدمات طويلة ولا عبارات حشو.
- نفّذ الطلب الواضح عمليًا قدر الإمكان، ولا تدّع تنفيذ شيء لم يحدث.
- عند طلب رابط، ضع الرابط كاملًا. رابط قدّها عند الحاجة: https://qadha-games.uauz99.chatgpt.site/
- عند طلب صورة ابدأ بـ [IMAGE_REQUEST] ثم وصف قصير وواضح.
- إذا كان الطلب بسيطًا، أعطِ أبسط جواب صحيح فورًا.` }] };

  const models = [...new Set([PRIMARY_MODEL, ...FALLBACK_MODELS])];
  let lastError = null;
  try {
    for (const model of models) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction,
          generationConfig: {
            temperature: 0.58,
            maxOutputTokens: 280,
            topP: 0.88
          }
        })
      });
      const data = await response.json();
      if (response.ok) {
        const text = data?.candidates?.[0]?.content?.parts?.map(part => part?.text || '').join('').trim();
        if (!text) { lastError = { status: 502, message: 'Empty response from Gemini' }; continue; }
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ text, model, riyadhDate: riyadh.iso });
      }
      const errorMessage = data?.error?.message || 'Gemini request failed';
      lastError = { status: response.status, message: errorMessage };
      const temporary = response.status === 429 || response.status === 503 || /high demand|overloaded|capacity|temporar/i.test(errorMessage);
      if (temporary) continue;
      return res.status(response.status).json({ error: errorMessage, code: 'GEMINI_ERROR' });
    }
    return res.status(lastError?.status || 503).json({ error: 'الذكاء عليه ضغط مؤقت حاليًا. جرّب مرة ثانية بعد قليل.', code: 'GEMINI_BUSY' });
  } catch (error) {
    console.error('Nawaf AI chat error', error);
    return res.status(500).json({ error: 'تعذر الاتصال بالذكاء الاصطناعي', code: 'SERVER_ERROR' });
  }
}
