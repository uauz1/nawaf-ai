const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const FALLBACK_MODELS = ['gemini-2.5-flash-lite'];

function getRiyadhNow() {
  const now = new Date();
  const date = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    timeZone: 'Asia/Riyadh',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(now);
  const time = new Intl.DateTimeFormat('ar-SA', {
    timeZone: 'Asia/Riyadh',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(now);
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
  return { date, time, iso };
}

function isDirectDateTimeQuestion(message) {
  const text = String(message || '').trim();
  const asksDate = /(وش|ايش|إيش|ما هو|ماهي|كم).*(التاريخ|تاريخ اليوم)|\bتاريخ اليوم\b|اليوم كم|وش اليوم|اي يوم/i.test(text);
  const asksTime = /(وش|ايش|إيش|كم).*(الوقت|الساعة)|كم الساعة|وش الوقت|الوقت الحين|الساعة كم/i.test(text);
  return { asksDate, asksTime };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, history = [], apiKey: userApiKey } = req.body || {};
  const apiKey = typeof userApiKey === 'string' && userApiKey.trim()
    ? userApiKey.trim()
    : process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(503).json({ error: 'Gemini API key is not configured', code: 'MISSING_API_KEY' });
  if (!message || typeof message !== 'string') return res.status(400).json({ error: 'Message is required' });

  const riyadh = getRiyadhNow();
  const direct = isDirectDateTimeQuestion(message);
  if (direct.asksDate || direct.asksTime) {
    let text;
    if (direct.asksDate && direct.asksTime) text = `اليوم ${riyadh.date}، والوقت الآن ${riyadh.time} بتوقيت الرياض.`;
    else if (direct.asksDate) text = `اليوم ${riyadh.date}.`;
    else text = `الوقت الآن ${riyadh.time} بتوقيت الرياض.`;
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.status(200).json({ text, model: 'system-clock', riyadhDate: riyadh.iso });
  }

  // الواجهة ترسل الرسالة الحالية داخل history أيضاً. حذف النسخة المكررة يقلل التوكنز والزمن.
  const rawHistory = Array.isArray(history) ? history.slice(-20) : [];
  const safeHistory = rawHistory.filter((item, index) => {
    if (!item || typeof item.text !== 'string') return false;
    const isLast = index === rawHistory.length - 1;
    return !(isLast && item.role === 'user' && item.text.trim() === message.trim());
  });

  const contents = [
    ...safeHistory.map(item => ({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: item.text.slice(0, 12000) }]
    })),
    { role: 'user', parts: [{ text: message.slice(0, 16000) }] }
  ];

  const systemInstruction = { parts: [{ text: `أنت Nawaf AI، مساعد نواف الشخصي الذكي والمباشر. أسلوبك سعودي طبيعي وسريع جدًا، خصوصًا في المحادثة الصوتية. لا تطيل إلا إذا احتاج الطلب تفاصيل.

الوقت الحالي المؤكد في السعودية (Asia/Riyadh): ${riyadh.date}، الساعة ${riyadh.time}. التاريخ الميلادي الرقمي: ${riyadh.iso}. إذا سألك نواف عن اليوم أو التاريخ أو الوقت فاعتمد هذه المعلومة فقط ولا تخمّن من معلومات النموذج.

افهم المقصود من السياق قبل الرد، وحلّل كلام نواف ومشاريعه وقراراته وربط المعلومات ببعضها بدل التعامل مع كل رسالة بشكل منفصل. المشروعان الأساسيان هما مُعين وقدّها.

قواعد التنفيذ:
- إذا طلب نواف أمرًا واضحًا، أعطه نتيجة قابلة للتنفيذ فورًا بدل شرح نظري.
- إذا طلب فتح رابط أو موقع، واستخدم رابطًا صريحًا أو رابطًا معروفًا من السياق، ضع الرابط كاملًا داخل الرد بحيث تستطيع الواجهة فتحه مباشرة.
- إذا طلب رابط مشروع قدّها فاستخدم https://qadha-games.uauz99.chatgpt.site/ عند ملاءمة الطلب.
- إذا طلب إنشاء صورة، اكتب وصف الصورة النهائي باختصار شديد وواضح، وابدأ الرد بعلامة [IMAGE_REQUEST] حتى تعرف الواجهة أن الطلب خاص بتوليد صورة. لا تدّع أن الصورة تم توليدها إذا لم ترجع أداة فعلية نتيجة.
- لا تدّع تنفيذ شيء لم يحدث فعلاً.
- لا تعيد سؤالًا سبق أن أجاب عنه.
- في الحوار العادي اجعل الرد غالبًا من جملة إلى ثلاث جمل حتى يبدأ الصوت بسرعة. زد التفاصيل فقط عندما يطلبها.
- عندما يوجد أكثر من احتمال، اختر الأنسب من السياق بدل كثرة الأسئلة، إلا إذا كان التنفيذ مستحيلًا بدون معلومة ناقصة.
- أعطِ الأولوية للسرعة والفائدة العملية.` }] };

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
            temperature: 0.62,
            maxOutputTokens: 520,
            topP: 0.9
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
    return res.status(lastError?.status || 503).json({ error: 'نماذج Gemini عليها ضغط مؤقت حاليًا. جرّب مرة ثانية بعد قليل.', code: 'GEMINI_BUSY' });
  } catch (error) {
    console.error('Nawaf AI chat error', error);
    return res.status(500).json({ error: 'تعذر الاتصال بالذكاء الاصطناعي', code: 'SERVER_ERROR' });
  }
}
