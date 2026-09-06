import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot, Brain, ExternalLink, Gauge, Github, Mic, MicOff, MoreHorizontal,
  RotateCcw, Search, Send, Settings, Sparkles, Volume2, VolumeX, X, Zap
} from 'lucide-react';

const QUICK_ACTIONS = [
  { id: 'ideas', icon: Sparkles, title: 'أفكار', prompt: 'أعطني 5 أفكار مناسبة لي بشكل مختصر وواضح.' },
  { id: 'solve', icon: Zap, title: 'حل مشكلة', prompt: 'ساعدني أحل المشكلة التالية بأسرع طريقة عملية: ' },
  { id: 'plan', icon: Brain, title: 'خطط', prompt: 'رتب لي خطة تنفيذ واضحة للمهمة التالية: ' },
  { id: 'code', icon: Gauge, title: 'برمجة', prompt: 'ساعدني في هذا الكود أو المشكلة التقنية: ' }
];

const PROJECTS = {
  mueen: {
    name: 'مُعين', letter: 'م',
    desc: 'القرآن، الصلاة، الأذكار، القبلة وتجربة إسلامية متكاملة.',
    repo: 'https://github.com/uauz1/mueen-islamic-app'
  },
  qadha: {
    name: 'قدّها', letter: 'ق',
    desc: 'منصة ألعاب جماعية وتحديات بين الأصدقاء.',
    repo: 'https://github.com/uauz1/game',
    app: 'https://qadha-games.uauz99.chatgpt.site/'
  }
};

const isIOS = () => {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/i.test(navigator.userAgent || '') ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

let speechRun = 0;
let activeAudio = null;
let activeUtterances = [];
let speechKeepAlive = null;

function clearSpeechKeepAlive() {
  if (speechKeepAlive) clearInterval(speechKeepAlive);
  speechKeepAlive = null;
}

function stopSpeech() {
  speechRun += 1;
  clearSpeechKeepAlive();
  activeUtterances = [];
  try {
    if (activeAudio) {
      activeAudio.pause?.();
      activeAudio.src = '';
    }
  } catch (_) {}
  activeAudio = null;
  try { window.speechSynthesis?.cancel?.(); } catch (_) {}
}

function pickArabicVoice() {
  const synth = window.speechSynthesis;
  if (!synth) return null;
  const voices = synth.getVoices?.() || [];
  const arabic = voices.filter(v => /^ar([_-]|$)/i.test(v.lang || ''));
  const saudi = arabic.filter(v => /ar[-_]SA/i.test(v.lang || ''));
  const preferred = /zariyah|hala|layla|laila|mariam|maryam|salma|sara|female|majed/i;
  return saudi.find(v => preferred.test(v.name || '')) || arabic.find(v => preferred.test(v.name || '')) || saudi[0] || arabic[0] || voices[0] || null;
}

function splitSpeech(text, maxWords = 7) {
  const cleaned = String(text || '').replace(/^\[IMAGE_REQUEST\]\s*/i, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const sentences = cleaned.split(/(?<=[.!?؟،؛:])\s+/u).filter(Boolean);
  const chunks = [];
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) chunks.push(sentence);
    else for (let i = 0; i < words.length; i += maxWords) chunks.push(words.slice(i, i + maxWords).join(' '));
  }
  return chunks.length ? chunks : [cleaned];
}

function primeSpeech() {
  const synth = window.speechSynthesis;
  if (!synth || !window.SpeechSynthesisUtterance) return;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.lang = 'ar-SA';
    u.volume = 0.01;
    u.rate = 2;
    activeUtterances.push(u);
    synth.speak(u);
    setTimeout(() => {
      try { synth.resume?.(); } catch (_) {}
    }, 30);
  } catch (_) {}
}

function speakInstant(text, onEnd, onStatus) {
  const chunks = splitSpeech(text, isIOS() ? 6 : 9);
  const synth = window.speechSynthesis;
  if (!chunks.length || !synth || !window.SpeechSynthesisUtterance) {
    onStatus?.('غير مدعوم');
    onEnd?.();
    return false;
  }

  stopSpeech();
  const run = speechRun;
  const voice = pickArabicVoice();
  let index = 0;
  let finished = false;
  let watchdog = null;

  const finish = () => {
    if (finished || run !== speechRun) return;
    finished = true;
    if (watchdog) clearTimeout(watchdog);
    clearSpeechKeepAlive();
    activeUtterances = [];
    onStatus?.('جاهز');
    onEnd?.();
  };

  const next = () => {
    if (finished || run !== speechRun) return;
    if (index >= chunks.length) return finish();

    const chunk = chunks[index++];
    const u = new SpeechSynthesisUtterance(chunk);
    u.lang = 'ar-SA';
    u.rate = isIOS() ? 1.08 : 1.05;
    u.pitch = 1.0;
    u.volume = 1;
    if (voice) u.voice = voice;
    activeUtterances = [u];

    if (watchdog) clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      if (run !== speechRun || finished) return;
      try { synth.resume?.(); } catch (_) {}
      setTimeout(() => {
        if (run !== speechRun || finished) return;
        try { synth.cancel?.(); } catch (_) {}
        setTimeout(next, 80);
      }, 700);
    }, 4200);

    u.onstart = () => {
      onStatus?.(`يتكلم ${index}/${chunks.length}`);
      try { synth.resume?.(); } catch (_) {}
    };
    u.onend = () => {
      if (watchdog) clearTimeout(watchdog);
      setTimeout(next, isIOS() ? 55 : 25);
    };
    u.onerror = event => {
      if (watchdog) clearTimeout(watchdog);
      const code = event?.error || '';
      if (/interrupted|canceled|cancelled/i.test(code)) setTimeout(next, 80);
      else finish();
    };

    try {
      synth.speak(u);
      setTimeout(() => { try { synth.resume?.(); } catch (_) {} }, 80);
    } catch (_) {
      setTimeout(next, 80);
    }
  };

  speechKeepAlive = setInterval(() => {
    if (run !== speechRun || finished) return clearSpeechKeepAlive();
    try { synth.resume?.(); } catch (_) {}
  }, 300);

  onStatus?.('بدء الصوت…');
  setTimeout(next, isIOS() ? 110 : 20);
  return true;
}

async function fetchNaturalAudio(text, apiKey, signal) {
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({ text: String(text || '').slice(0, 1200), apiKey: apiKey?.trim() || undefined })
  });
  const data = await response.json();
  if (!response.ok || !data?.audioBase64) throw new Error(data?.error || 'تعذر توليد الصوت');
  return data;
}

function playAudioData(data, run, onStatus) {
  return new Promise((resolve, reject) => {
    if (!data || run !== speechRun) return resolve();
    const audio = new Audio(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
    activeAudio = audio;
    audio.preload = 'auto';
    audio.onplaying = () => onStatus?.('صوت طبيعي');
    audio.onended = () => {
      if (activeAudio === audio) activeAudio = null;
      resolve();
    };
    audio.onerror = error => {
      if (activeAudio === audio) activeAudio = null;
      reject(error || new Error('audio playback failed'));
    };
    audio.play().catch(reject);
  });
}

async function speakHybrid(text, apiKey, onEnd, onStatus) {
  const cleaned = String(text || '').replace(/^\[IMAGE_REQUEST\]\s*/i, '').trim();
  if (!cleaned) return onEnd?.();
  stopSpeech();
  const run = speechRun;
  const words = cleaned.split(/\s+/);
  const firstText = words.slice(0, 9).join(' ');
  const restText = words.slice(9).join(' ');
  const c1 = new AbortController();
  const c2 = new AbortController();
  let fallbackStarted = false;

  const fallback = () => {
    if (fallbackStarted || run !== speechRun) return;
    fallbackStarted = true;
    try { c1.abort(); c2.abort(); } catch (_) {}
    speakInstant(cleaned, onEnd, onStatus);
  };

  const fallbackTimer = setTimeout(fallback, 2400);
  onStatus?.('تجهيز صوت طبيعي…');

  try {
    const firstPromise = fetchNaturalAudio(firstText, apiKey, c1.signal);
    const restPromise = restText ? fetchNaturalAudio(restText, apiKey, c2.signal).catch(() => null) : Promise.resolve(null);
    const first = await firstPromise;
    if (run !== speechRun || fallbackStarted) return;
    clearTimeout(fallbackTimer);
    await playAudioData(first, run, onStatus);
    const rest = await restPromise;
    if (rest && run === speechRun) await playAudioData(rest, run, onStatus);
    if (run === speechRun) {
      onStatus?.('جاهز');
      onEnd?.();
    }
  } catch (error) {
    clearTimeout(fallbackTimer);
    if (error?.name !== 'AbortError') fallback();
  }
}

function extractUrl(text) {
  const match = String(text || '').match(/https?:\/\/[^\s)\]}>,]+/i);
  return match ? match[0].replace(/[.,،؛]+$/, '') : '';
}

function getLocalDateTimeReply(message) {
  const text = String(message || '').trim();
  const asksDate = /(تاريخ اليوم|وش اليوم|اي يوم|أي يوم|اليوم كم)/i.test(text);
  const asksTime = /(كم الساعة|وش الوقت|الوقت الحين|الساعة كم)/i.test(text);
  if (!asksDate && !asksTime) return '';
  const now = new Date();
  const date = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    timeZone: 'Asia/Riyadh', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  }).format(now);
  const time = new Intl.DateTimeFormat('ar-SA', {
    timeZone: 'Asia/Riyadh', hour: 'numeric', minute: '2-digit', hour12: true
  }).format(now);
  if (asksDate && asksTime) return `اليوم ${date}، والوقت الآن ${time} بتوقيت الرياض.`;
  if (asksDate) return `اليوم ${date}.`;
  return `الوقت الآن ${time} بتوقيت الرياض.`;
}

function SettingsPanel({ settings, setSettings, onClose, onTestVoice, voiceStatus }) {
  const toggle = key => setSettings(s => ({ ...s, [key]: !s[key] }));
  const arabicVoices = typeof window !== 'undefined' && window.speechSynthesis
    ? (window.speechSynthesis.getVoices?.() || []).filter(v => /^ar([_-]|$)/i.test(v.lang || '')).length
    : 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="settings-panel" onClick={e => e.stopPropagation()}>
        <div className="panel-head">
          <div><small>Nawaf AI</small><h2>الإعدادات</h2></div>
          <button className="icon-btn" onClick={onClose}><X size={22}/></button>
        </div>

        <div className="setting-block">
          <div className="setting-title"><b>محرك الصوت</b><span>{voiceStatus}</span></div>
          <div className="segmented">
            <button className={settings.voiceMode === 'instant' ? 'active' : ''} onClick={() => setSettings(s => ({ ...s, voiceMode: 'instant' }))}><Zap size={17}/>فوري</button>
            <button className={settings.voiceMode === 'hybrid' ? 'active' : ''} onClick={() => setSettings(s => ({ ...s, voiceMode: 'hybrid' }))}><Volume2 size={17}/>ذكي</button>
          </div>
          <p className="setting-note">الذكي يستخدم Gemini TTS أولًا ثم يتحول تلقائيًا للصوت الفوري إذا تأخر. الأصوات العربية المتاحة على الجهاز: {arabicVoices}.</p>
          <button className="ghost-btn" onClick={onTestVoice}><Volume2 size={18}/>اختبار الصوت الآن</button>
        </div>

        <div className="setting-row" onClick={() => toggle('voiceReplies')}>
          <div><b>الرد بالصوت</b><span>تشغيل الصوت بعد كل رد</span></div>
          <i className={settings.voiceReplies ? 'switch on' : 'switch'}><em/></i>
        </div>
        <div className="setting-row" onClick={() => toggle('continuousVoice')}>
          <div><b>المحادثة المستمرة</b><span>يرد ثم يرجع يسمعك تلقائيًا</span></div>
          <i className={settings.continuousVoice ? 'switch on' : 'switch'}><em/></i>
        </div>
        <div className="setting-row" onClick={() => toggle('rain')}>
          <div><b>تأثير المطر</b><span>حركة خلفية خفيفة</span></div>
          <i className={settings.rain ? 'switch on' : 'switch'}><em/></i>
        </div>
        <div className="setting-row" onClick={() => toggle('motion')}>
          <div><b>الحركات</b><span>أنيميشن خفيف للواجهة</span></div>
          <i className={settings.motion ? 'switch on' : 'switch'}><em/></i>
        </div>

        <div className="setting-block api-box">
          <div className="setting-title"><b>Gemini API Key</b><span>{settings.geminiApiKey?.trim() ? 'مضاف' : 'اختياري إذا كان موجود على Vercel'}</span></div>
          <input type="password" dir="ltr" autoComplete="off" placeholder="AIza..." value={settings.geminiApiKey || ''}
            onChange={e => setSettings(s => ({ ...s, geminiApiKey: e.target.value }))}/>
        </div>

        <div className="panel-actions">
          <button className="ghost-btn" onClick={() => setSettings(s => ({ ...s, voiceReplies: true, continuousVoice: true, voiceMode: 'hybrid', rain: true, motion: true, voiceVersion: 4 }))}><RotateCcw size={18}/>افتراضي</button>
          <button className="primary-btn" onClick={onClose}>حفظ</button>
        </div>
      </section>
    </div>
  );
}

function ProjectPanel({ project, onClose }) {
  if (!project) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="project-panel" onClick={e => e.stopPropagation()}>
        <div className="panel-head">
          <div><small>لوحة المشروع</small><h2>{project.name}</h2></div>
          <button className="icon-btn" onClick={onClose}><X size={22}/></button>
        </div>
        <div className="project-hero"><div className="project-avatar">{project.letter}</div><div><h3>{project.name}</h3><p>{project.desc}</p></div></div>
        <div className="project-links">
          {project.app && <button onClick={() => window.open(project.app, '_blank', 'noopener,noreferrer')}><ExternalLink size={20}/>فتح الموقع</button>}
          <button onClick={() => window.open(project.repo, '_blank', 'noopener,noreferrer')}><Github size={20}/>فتح GitHub</button>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const defaults = { voiceReplies: true, continuousVoice: true, voiceMode: 'hybrid', rain: true, motion: true, geminiApiKey: '', voiceVersion: 4 };
  const [settings, setSettings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('nawaf-ai-settings')) || {};
      if ((saved.voiceVersion || 0) < 4) return { ...defaults, geminiApiKey: saved.geminiApiKey || '' };
      return { ...defaults, ...saved };
    } catch { return defaults; }
  });
  const [messages, setMessages] = useState([{ role: 'assistant', text: 'جاهز لك. اضغط المايك وتكلم طبيعي.' }]);
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [project, setProject] = useState(null);
  const [search, setSearch] = useState('');
  const [voiceStatus, setVoiceStatus] = useState('جاهز');
  const [lastLatency, setLastLatency] = useState(null);

  const messagesRef = useRef(messages);
  const loadingRef = useRef(false);
  const speakingRef = useRef(false);
  const listeningRef = useRef(false);
  const recognitionRef = useRef(null);
  const restartWantedRef = useRef(false);
  const restartTimerRef = useRef(null);
  const utteranceRef = useRef('');
  const scrollRef = useRef(null);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);
  useEffect(() => { speakingRef.current = speaking; }, [speaking]);
  useEffect(() => { listeningRef.current = listening; }, [listening]);
  useEffect(() => localStorage.setItem('nawaf-ai-settings', JSON.stringify(settings)), [settings]);
  useEffect(() => { scrollRef.current?.scrollTo?.({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, loading]);
  useEffect(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices?.();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices?.();
    }
  }, []);

  const greeting = useMemo(() => {
    const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Riyadh', hour: '2-digit', hour12: false }).format(new Date()));
    return h < 12 ? 'صباح الخير يا نواف' : h < 18 ? 'مساء الخير يا نواف' : 'يا مساء الخير يا نواف';
  }, []);

  const status = listening ? 'أسمعك الآن…' : speaking ? voiceStatus : loading ? 'أجهز الرد…' : settings.continuousVoice && restartWantedRef.current ? 'جاهز أسمعك تلقائيًا' : 'جاهز';

  const clearRestartTimer = () => {
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    restartTimerRef.current = null;
  };

  const stopRecognition = (abort = true) => {
    clearRestartTimer();
    try { abort ? recognitionRef.current?.abort?.() : recognitionRef.current?.stop?.(); } catch (_) {}
    recognitionRef.current = null;
    setListening(false);
    listeningRef.current = false;
  };

  const stopEverything = () => {
    restartWantedRef.current = false;
    stopRecognition(true);
    stopSpeech();
    setSpeaking(false);
    speakingRef.current = false;
    setVoiceStatus('جاهز');
  };

  useEffect(() => () => stopEverything(), []);

  const scheduleRestart = (delay = 380) => {
    clearRestartTimer();
    if (!settings.continuousVoice || !restartWantedRef.current || loadingRef.current || speakingRef.current) return;
    restartTimerRef.current = setTimeout(() => {
      if (settings.continuousVoice && restartWantedRef.current && !loadingRef.current && !speakingRef.current && !listeningRef.current) beginListening(true);
    }, delay);
  };

  const finishSpeaking = () => {
    setSpeaking(false);
    speakingRef.current = false;
    setVoiceStatus('جاهز');
    if (settings.continuousVoice && restartWantedRef.current) scheduleRestart(420);
  };

  const speakReply = text => {
    if (!settings.voiceReplies) {
      if (settings.continuousVoice && restartWantedRef.current) scheduleRestart(280);
      return;
    }
    setSpeaking(true);
    speakingRef.current = true;
    if (settings.voiceMode === 'instant') speakInstant(text, finishSpeaking, setVoiceStatus);
    else speakHybrid(text, settings.geminiApiKey, finishSpeaking, setVoiceStatus);
  };

  const testVoice = () => {
    primeSpeech();
    restartWantedRef.current = false;
    setSpeaking(true);
    speakingRef.current = true;
    speakInstant('هلا نواف، هذا اختبار الصوت. إذا سمعتني كامل فالمحرك شغال مضبوط.', finishSpeaking, setVoiceStatus);
  };

  const maybeOpenDirectly = (message, reply = '') => {
    const wantsOpen = /(افتح|فتح|ودني|روح|الرابط|لينك)/i.test(message || '');
    if (!wantsOpen) return false;
    let url = extractUrl(message) || extractUrl(reply);
    if (!url && /(قد.?ها|قدها)/i.test(message)) url = PROJECTS.qadha.app;
    if (!url && /(مُ?عين|معين)/i.test(message)) url = PROJECTS.mueen.repo;
    if (!url) return false;
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  };

  const sendMessage = async (forcedText, fromVoice = false) => {
    const message = String(forcedText ?? value).trim();
    if (!message || loadingRef.current) return;
    const startedAt = performance.now();

    stopRecognition(true);
    setError('');
    setValue('');
    const next = [...messagesRef.current, { role: 'user', text: message }];
    messagesRef.current = next;
    setMessages(next);
    if (fromVoice) restartWantedRef.current = true;

    const localReply = getLocalDateTimeReply(message);
    if (localReply) {
      const completed = [...next, { role: 'assistant', text: localReply }];
      messagesRef.current = completed;
      setMessages(completed);
      setLastLatency(Math.round(performance.now() - startedAt));
      speakReply(localReply);
      return;
    }

    maybeOpenDirectly(message);
    setLoading(true);
    loadingRef.current = true;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ message, history: next.slice(-6), apiKey: settings.geminiApiKey?.trim() || undefined })
      });
      clearTimeout(timeout);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'تعذر الحصول على رد');
      const cleanText = String(data.text || '').replace(/^\[IMAGE_REQUEST\]\s*/i, '').trim() || 'تم.';
      const completed = [...next, { role: 'assistant', text: cleanText }];
      messagesRef.current = completed;
      setMessages(completed);
      setLastLatency(Math.round(performance.now() - startedAt));
      maybeOpenDirectly(message, data.text);
      speakReply(cleanText);
    } catch (err) {
      const msg = err?.name === 'AbortError' ? 'الرد تأخر أكثر من اللازم. جرّب مرة ثانية.' : (err?.message || 'تعذر الاتصال بالذكاء الاصطناعي');
      setError(msg);
      if (settings.continuousVoice && restartWantedRef.current) scheduleRestart(650);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  const beginListening = (automatic = false) => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setError('المتصفح هذا ما يدعم التعرف الصوتي. افتح الصفحة من Safari أو Chrome واسمح للمايك.');
      restartWantedRef.current = false;
      return;
    }
    if (loadingRef.current || listeningRef.current || speakingRef.current) return;

    primeSpeech();
    stopSpeech();
    stopRecognition(true);
    setError('');
    utteranceRef.current = '';

    const recognition = new Recognition();
    recognition.lang = 'ar-SA';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    let finalText = '';
    let liveText = '';
    let fatal = false;

    recognition.onstart = () => {
      setListening(true);
      listeningRef.current = true;
      restartWantedRef.current = true;
    };

    recognition.onresult = event => {
      liveText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i]?.[0]?.transcript || '';
        if (event.results[i].isFinal) finalText += `${t} `;
        else liveText += `${t} `;
      }
      const combined = `${finalText}${liveText}`.trim();
      if (combined) {
        utteranceRef.current = combined;
        setValue(combined);
      }
    };

    recognition.onerror = event => {
      const code = event?.error;
      setListening(false);
      listeningRef.current = false;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        fatal = true;
        restartWantedRef.current = false;
        setError('اسمح للموقع باستخدام الميكروفون من إعدادات Safari ثم جرّب مرة ثانية.');
      } else if (code === 'audio-capture') {
        fatal = true;
        restartWantedRef.current = false;
        setError('تعذر الوصول للمايك. تأكد من صلاحية الميكروفون.');
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setListening(false);
      listeningRef.current = false;
      const text = finalText.trim() || utteranceRef.current.trim() || liveText.trim();
      if (text) {
        setValue('');
        sendMessage(text, true);
      } else if (!fatal && settings.continuousVoice && restartWantedRef.current) {
        scheduleRestart(automatic ? 520 : 380);
      }
    };

    recognitionRef.current = recognition;
    try { recognition.start(); }
    catch (_) {
      recognitionRef.current = null;
      setListening(false);
      listeningRef.current = false;
      if (automatic && settings.continuousVoice && restartWantedRef.current) scheduleRestart(700);
      else setError('تعذر بدء الاستماع. اضغط المايك مرة ثانية.');
    }
  };

  const toggleMic = () => {
    primeSpeech();
    if (listeningRef.current) {
      restartWantedRef.current = false;
      stopRecognition(true);
      return;
    }
    if (speakingRef.current) stopSpeech();
    restartWantedRef.current = true;
    beginListening(false);
  };

  const useQuickAction = action => {
    setValue(action.prompt);
    setTimeout(() => document.querySelector('.composer textarea')?.focus?.(), 0);
  };

  const replayLast = () => {
    const last = [...messagesRef.current].reverse().find(m => m.role === 'assistant' && m.text);
    if (last) speakReply(last.text);
  };

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const items = [
      ...QUICK_ACTIONS.map(a => ({ type: 'action', id: a.id, title: a.title, sub: a.prompt, data: a })),
      { type: 'project', id: 'mueen', title: 'مُعين', sub: PROJECTS.mueen.desc, data: PROJECTS.mueen },
      { type: 'project', id: 'qadha', title: 'قدّها', sub: PROJECTS.qadha.desc, data: PROJECTS.qadha }
    ];
    return items.filter(item => `${item.title} ${item.sub}`.toLowerCase().includes(q)).slice(0, 6);
  }, [search]);

  return (
    <div className={`app ${settings.motion ? 'motion' : ''}`} dir="rtl">
      <div className="ambient-bg"/>{settings.rain && <div className="rain" aria-hidden="true"/>}
      <div className="app-shell">
        <header className="topbar">
          <div className="brand"><div className="brand-orb"><Bot size={24}/></div><div><b>Nawaf AI</b><span><i className={listening ? 'live' : speaking ? 'talking' : ''}/>{status}</span></div></div>
          <div className="top-actions"><button className="icon-btn" onClick={() => setSettingsOpen(true)}><Settings size={21}/></button><button className="icon-btn" onClick={stopEverything}><VolumeX size={21}/></button></div>
        </header>

        <section className="hero">
          <div className="hero-copy"><span className="eyebrow"><Sparkles size={16}/>Voice Engine v4</span><h1>{greeting}</h1><p>صوت أسرع، تشخيص مباشر، وإعادة تشغيل آخر رد بضغطة واحدة.</p></div>
          <button className={`big-mic ${listening ? 'listening' : speaking ? 'speaking' : ''}`} onClick={toggleMic}>{listening ? <MicOff size={34}/> : <Mic size={34}/>}<span/></button>
        </section>

        <div className="search-wrap"><Search size={19}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث في الأدوات والمشاريع…"/>{search && <button onClick={() => setSearch('')}><X size={17}/></button>}{search && <div className="search-popover">{results.length ? results.map(item => <button key={`${item.type}-${item.id}`} onClick={() => { setSearch(''); item.type === 'project' ? setProject(item.data) : useQuickAction(item.data); }}><b>{item.title}</b><span>{item.sub}</span></button>) : <div className="no-result">ما لقيت شيء مطابق</div>}</div>}</div>

        <section className="quick-grid">{QUICK_ACTIONS.map(action => { const Icon = action.icon; return <button key={action.id} onClick={() => useQuickAction(action)}><span><Icon size={20}/></span><b>{action.title}</b></button>; })}</section>

        <section className="conversation-card">
          <div className="conversation-head">
            <div><b>المحادثة</b><span>{settings.voiceMode === 'instant' ? 'صوت فوري' : 'صوت ذكي'}{lastLatency != null ? ` • رد ${lastLatency}ms` : ''}</span></div>
            <div style={{display:'flex',gap:8}}><button className="tiny-btn" onClick={replayLast}><Volume2 size={16}/>أعد الصوت</button><button className="tiny-btn" onClick={() => { stopEverything(); const fresh = [{ role: 'assistant', text: 'بدأنا من جديد. وش تحتاج؟' }]; setMessages(fresh); messagesRef.current = fresh; }}><RotateCcw size={16}/>جديد</button></div>
          </div>
          <div className="messages" ref={scrollRef}>{messages.map((m, i) => <div key={i} className={`message ${m.role}`}><div>{m.text}</div></div>)}{loading && <div className="message assistant"><div className="typing"><i/><i/><i/></div></div>}</div>
          {error && <div className="error-box">{error}</div>}
          <div className="composer"><textarea rows="1" value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder={listening ? 'أسمعك الآن…' : 'اكتب أو اضغط المايك وتكلم…'}/><button className={`composer-mic ${listening ? 'active' : ''}`} onClick={toggleMic}>{listening ? <MicOff size={23}/> : <Mic size={23}/>}</button><button className="send-btn" disabled={!value.trim() || loading} onClick={() => sendMessage()}><Send size={21}/></button></div>
        </section>

        <section className="projects-block"><div className="section-head"><div><span>مشاريعي</span><h2>وصول مباشر</h2></div><MoreHorizontal size={22}/></div><div className="projects-grid">{Object.entries(PROJECTS).map(([id, p]) => <button className="project-card" key={id} onClick={() => setProject(p)}><div className="project-mark">{p.letter}</div><div><b>{p.name}</b><span>{p.desc}</span></div><ExternalLink size={19}/></button>)}</div></section>
        <footer className="footer-note"><Zap size={15}/>Voice Engine v4 • Gemini 3.6 minimal thinking • محادثة مستمرة</footer>
      </div>

      {settingsOpen && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setSettingsOpen(false)} onTestVoice={testVoice} voiceStatus={voiceStatus}/>} 
      {project && <ProjectPanel project={project} onClose={() => setProject(null)}/>} 
    </div>
  );
}
