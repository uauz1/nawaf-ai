const MODEL = 'gemini-3.1-flash-tts-preview';
const VOICE = 'Aoede';

function pcm16ToWavBase64(pcmBase64, sampleRate = 24000) {
  const pcm = Buffer.from(pcmBase64, 'base64');
  const header = Buffer.alloc(44);
  const channels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * channels * bitsPerSample / 8;
  const blockAlign = channels * bitsPerSample / 8;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]).toString('base64');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, apiKey: userApiKey } = req.body || {};
  const apiKey = typeof userApiKey === 'string' && userApiKey.trim()
    ? userApiKey.trim()
    : process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(503).json({ error: 'Gemini API key is not configured', code: 'MISSING_API_KEY' });
  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'Text is required' });

  const prompt = `اقرئي النص التالي فقط. الصوت أنثوي شاب وواضح وطبيعي، بلهجة سعودية خفيفة، بسرعة محادثة طبيعية ومريحة، ومن دون نبرة آلية أو مبالغة. لا تضيفي أي كلمة غير موجودة في النص.\n\n${text.slice(0, 1000)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8500);

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            languageCode: 'ar',
            voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } }
          }
        }
      })
    });
    clearTimeout(timeout);
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || `TTS failed (${response.status})`, code: 'TTS_ERROR' });
    }

    const part = data?.candidates?.[0]?.content?.parts?.find(p => p?.inlineData?.data);
    if (!part?.inlineData?.data) return res.status(502).json({ error: 'Empty audio response', code: 'EMPTY_TTS' });

    const mime = part.inlineData.mimeType || 'audio/L16;rate=24000';
    const rateMatch = /rate=(\d+)/i.exec(mime);
    const sampleRate = rateMatch ? Number(rateMatch[1]) : 24000;
    const wavBase64 = /audio\/(wav|wave)/i.test(mime)
      ? part.inlineData.data
      : pcm16ToWavBase64(part.inlineData.data, sampleRate);

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ audioBase64: wavBase64, mimeType: 'audio/wav', voice: VOICE, model: MODEL, language: 'ar' });
  } catch (error) {
    clearTimeout(timeout);
    if (error?.name === 'AbortError') return res.status(504).json({ error: 'TTS timeout', code: 'TTS_TIMEOUT' });
    return res.status(503).json({ error: error?.message || 'تعذر توليد الصوت الآن', code: 'TTS_BUSY' });
  }
}
