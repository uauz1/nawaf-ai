const PRIMARY_MODEL = 'gemini-3.6-flash';

function getRiyadhNow() {
  const now = new Date();
  const date = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    timeZone: 'Asia/Riyadh', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  }).format(now);
  const time = new Intl.DateTimeFormat('ar-SA', {
    timeZone: 'Asia/Riyadh', hour: 'numeric', minute: '2-digit', hour12: true
  }).format(now);
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);
  return { date, time, iso };
}

function quickLocalReply(message, riyadh) {
  const text = String(message || '').trim();
  const asksDate = /(وش|ايش|إيش|ما هو|ماهي|كم).*(التاريخ|تاريخ اليوم)|تاريخ اليوم|اليوم كم|وش اليوم|اي يوم|أي يوم/i.test(text);
  const asksTime = /(وش|ايش|إيش|كم).*(الوقت|الساعة)|كم الساعة|وش الوقت|الوقت الحين|الساعة كم/i.test(text);
  if (!asksDate && !asksTime) return '';
  if (asksDate && asksTime) return `اليوم ${riyadh.date}، والوقت الآن ${riyadh.time} بتوقيت الرياض.`;
  if (asksDate) return `اليوم ${riyadh.date}.`;
  return `الوقت الآن ${riyadh.time} بتوقيت الرياض.`;
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

  const rawHistory = Array.isArray(history) ? history.slice(-6) : [];
  const safeHistory = rawHistory.filter((item, index) => {
    if (!item || typeof item.text !== 'string') return false;
    const isLast = index === rawHistory.length - 1;
    return !(isLast && item.role === 'user' && item.text.trim() === message.trim());
  });

  const contents = [
    ...safeHistory.map(item => ({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: item.text.slice(0, 3200) }]
    })),
    { role: 'user', parts: [{ text: message.slice(0, 7000) }] }
  ];

  const systemInstruction = { parts: [{ text: `أنت Nawaf AI، مساعد نواف الشخصي الذكي والسريع. تحدث بسعودي طبيعي ومباشر.

الوقت الحالي المؤكد في السعودية (Asia/Riyadh): ${riyadh.date}، الساعة ${riyadh.time}. التاريخ الميلادي الرقمي: ${riyadh.iso}. لا تخمّن التاريخ أو الوقت.

المشروعان الأساسيان: مُعين وقدّها. اربط السياق السابق لكن لا تكرر الكلام.

قواعد الرد:
- أعط الجواب من أول جملة بدون مقدمة.
- للمحادثة الصوتية واليومية: جملة أو جملتان غالبًا، ثم تفاصيل فقط عند الحاجة.
- إذا كان الطلب معقدًا: النتيجة أولًا ثم النقاط المهمة.
- لا تدّع تنفيذ شيء لم يحدث.
- إذا طلب رابطًا، ضعه كاملًا. رابط قدّها عند الحاجة: https://qadha-games.uauz99.chatgpt.site/
- إذا طلب صورة ابدأ بـ [IMAGE_REQUEST] ثم وصف قصير وواضح.
- لا تسأل سؤالًا إضافيًا إلا إذا كان التنفيذ مستحيلًا بدونه.` }] };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${PRIMARY_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents,
        systemInstruction,
        generationConfig: {
          thinkingConfig: { thinkingLevel: 'minimal' },
          maxOutputTokens: 220
        }
      })
    });
    clearTimeout(timeout);
    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data?.error?.message || 'Gemini request failed';
      return res.status(response.status).json({ error: errorMessage, code: 'GEMINI_ERROR', model: PRIMARY_MODEL });
    }

    const text = data?.candidates?.[0]?.content?.parts?.map(part => part?.text || '').join('').trim();
    if (!text) return res.status(502).json({ error: 'رجع الذكاء رد فارغ. جرّب مرة ثانية.', code: 'EMPTY_RESPONSE' });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ text, model: PRIMARY_MODEL, riyadhDate: riyadh.iso });
  } catch (error) {
    clearTimeout(timeout);
    if (error?.name === 'AbortError') return res.status(504).json({ error: 'الرد تأخر أكثر من اللازم. جرّب مرة ثانية.', code: 'AI_TIMEOUT' });
    console.error('Nawaf AI chat error', error);
    return res.status(500).json({ error: 'تعذر الاتصال بالذكاء الاصطناعي', code: 'SERVER_ERROR' });
  }
}
