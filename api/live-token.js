const LIVE_MODEL = 'gemini-3.1-flash-live-preview';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Gemini API key is not configured', code: 'MISSING_API_KEY' });

  const expireTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const newSessionExpireTime = new Date(Date.now() + 60 * 1000).toISOString();

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        uses: 1,
        expireTime,
        newSessionExpireTime,
        liveConnectConstraints: {
          model: `models/${LIVE_MODEL}`,
          config: {
            sessionResumption: {},
            responseModalities: ['AUDIO']
          }
        }
      })
    });

    const data = await response.json();
    if (!response.ok || !data?.name) {
      return res.status(response.status || 502).json({
        error: data?.error?.message || 'تعذر إنشاء جلسة الصوت المباشر',
        code: 'LIVE_TOKEN_ERROR'
      });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ token: data.name, model: LIVE_MODEL, expiresAt: expireTime });
  } catch (error) {
    console.error('Live token error', error);
    return res.status(500).json({ error: 'تعذر تجهيز جلسة الصوت المباشر', code: 'LIVE_TOKEN_SERVER_ERROR' });
  }
}
