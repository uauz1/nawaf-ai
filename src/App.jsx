import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot, Brain, ExternalLink, Gauge, Github, Mic, MicOff, MoreHorizontal,
  RotateCcw, Search, Send, Settings, Sparkles, VolumeX, X, Zap
} from 'lucide-react';
import { GeminiLiveVoice } from './live-voice.js';

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

function extractUrl(text) {
  const match = String(text || '').match(/https?:\/\/[^\s)\]}>,]+/i);
  return match ? match[0].replace(/[.,،؛]+$/, '') : '';
}

function SettingsPanel({ settings, setSettings, onClose }) {
  const toggle = key => setSettings(s => ({ ...s, [key]: !s[key] }));
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="settings-panel" onClick={e => e.stopPropagation()}>
        <div className="panel-head">
          <div><small>Nawaf AI</small><h2>الإعدادات</h2></div>
          <button className="icon-btn" onClick={onClose}><X size={22}/></button>
        </div>

        <div className="setting-block">
          <div className="setting-title"><b>الصوت المباشر</b><span>Gemini Live 3.1</span></div>
          <p className="setting-note">المحادثة الصوتية تستخدم الآن Gemini Live مباشرة: المايك → Gemini → صوت Gemini، بدون تحويل الكلام إلى نص ثم انتظار TTS.</p>
        </div>

        <div className="setting-row" onClick={() => toggle('continuousVoice')}>
          <div><b>المحادثة المستمرة</b><span>يبقى المايك جاهز بعد انتهاء رد Gemini</span></div>
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

        <div className="setting-block">
          <div className="setting-title"><b>صلاحية الآيفون المطلوبة</b><span>الميكروفون فقط</span></div>
          <p className="setting-note">ما فيه إذن منفصل للسماعة في Safari. أول ضغطة على المايك تطلب إذن الميكروفون، وتشغيل الصوت يتم من AudioContext بدأ بنفس الضغطة.</p>
        </div>

        <div className="panel-actions">
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
        <div className="project-hero">
          <div className="project-avatar">{project.letter}</div>
          <div><h3>{project.name}</h3><p>{project.desc}</p></div>
        </div>
        <div className="project-links">
          {project.app && <button onClick={() => window.open(project.app, '_blank', 'noopener,noreferrer')}><ExternalLink size={20}/>فتح الموقع</button>}
          <button onClick={() => window.open(project.repo, '_blank', 'noopener,noreferrer')}><Github size={20}/>فتح GitHub</button>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const defaults = { continuousVoice: true, rain: true, motion: true, voiceVersion: 5 };
  const [settings, setSettings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('nawaf-ai-settings')) || {};
      return { ...defaults, ...saved, voiceVersion: 5 };
    } catch { return defaults; }
  });

  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'جاهز لك. اضغط المايك مرة واحدة وابدأ محادثة مباشرة.' }
  ]);
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [voiceState, setVoiceState] = useState('idle');
  const [voiceDetail, setVoiceDetail] = useState('جاهز');
  const [liveUserText, setLiveUserText] = useState('');
  const [liveAssistantText, setLiveAssistantText] = useState('');
  const [error, setError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [project, setProject] = useState(null);
  const [search, setSearch] = useState('');
  const [lastLatency, setLastLatency] = useState(null);

  const liveRef = useRef(null);
  const messagesRef = useRef(messages);
  const scrollRef = useRef(null);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => localStorage.setItem('nawaf-ai-settings', JSON.stringify(settings)), [settings]);
  useEffect(() => { scrollRef.current?.scrollTo?.({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, liveUserText, liveAssistantText, loading]);
  useEffect(() => () => { liveRef.current?.stop?.(); }, []);

  const greeting = useMemo(() => {
    const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Riyadh', hour: '2-digit', hour12: false }).format(new Date()));
    return h < 12 ? 'صباح الخير يا نواف' : h < 18 ? 'مساء الخير يا نواف' : 'يا مساء الخير يا نواف';
  }, []);

  const activeVoice = voiceState !== 'idle' && voiceState !== 'error';
  const listening = voiceState === 'listening';
  const speaking = voiceState === 'speaking';

  const appendMessage = (role, text) => {
    const cleaned = String(text || '').trim();
    if (!cleaned) return;
    const current = messagesRef.current;
    const last = current[current.length - 1];
    if (last?.role === role && last?.text === cleaned) return;
    const next = [...current, { role, text: cleaned }];
    messagesRef.current = next;
    setMessages(next);
  };

  const stopLive = async () => {
    const session = liveRef.current;
    liveRef.current = null;
    if (session) await session.stop();
    setVoiceState('idle');
    setVoiceDetail('جاهز');
    setLiveUserText('');
    setLiveAssistantText('');
  };

  const startLive = async () => {
    if (liveRef.current) return;
    setError('');
    setVoiceState('connecting');
    setVoiceDetail('أطلب إذن المايك وأجهز Gemini Live…');

    const session = new GeminiLiveVoice({
      onState: (state, detail) => {
        setVoiceState(state);
        setVoiceDetail(detail || state);
      },
      onInputText: (text, final) => {
        if (final) {
          appendMessage('user', text);
          setLiveUserText('');
        } else setLiveUserText(text);
      },
      onOutputText: (text, final) => {
        if (final) {
          appendMessage('assistant', text);
          setLiveAssistantText('');
        } else setLiveAssistantText(text);
      },
      onError: message => {
        setError(message);
        setVoiceState('error');
        setVoiceDetail('خطأ بالصوت');
      }
    });

    liveRef.current = session;
    try {
      await session.start();
    } catch (err) {
      liveRef.current = null;
      const name = err?.name || '';
      const message = name === 'NotAllowedError'
        ? 'إذن الميكروفون مرفوض. من إعدادات Safari للموقع اختر السماح بالميكروفون ثم جرّب مرة ثانية.'
        : (err?.message || 'تعذر بدء المحادثة الصوتية المباشرة.');
      setError(message);
      setVoiceState('error');
      setVoiceDetail('تعذر بدء الصوت');
      try { await session.stop(); } catch (_) {}
    }
  };

  const toggleMic = () => {
    if (activeVoice || liveRef.current) stopLive();
    else startLive();
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

  const sendTextMessage = async () => {
    const message = value.trim();
    if (!message || loading) return;
    const started = performance.now();
    setValue('');
    setError('');
    appendMessage('user', message);
    maybeOpenDirectly(message);
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history: [...messagesRef.current, { role: 'user', text: message }].slice(-6) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'تعذر الحصول على رد');
      const text = String(data.text || '').replace(/^\[IMAGE_REQUEST\]\s*/i, '').trim() || 'تم.';
      appendMessage('assistant', text);
      setLastLatency(Math.round(performance.now() - started));
      maybeOpenDirectly(message, data.text);
    } catch (err) {
      setError(err?.message || 'تعذر الاتصال بالذكاء الاصطناعي');
    } finally {
      setLoading(false);
    }
  };

  const useQuickAction = action => {
    setValue(action.prompt);
    setTimeout(() => document.querySelector('.composer textarea')?.focus?.(), 0);
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
      <div className="ambient-bg"/>
      {settings.rain && <div className="rain" aria-hidden="true"/>}

      <div className="app-shell">
        <header className="topbar">
          <div className="brand">
            <div className="brand-orb"><Bot size={24}/></div>
            <div><b>Nawaf AI</b><span><i className={listening ? 'live' : speaking ? 'talking' : ''}/>{voiceDetail}</span></div>
          </div>
          <div className="top-actions">
            <button className="icon-btn" onClick={() => setSettingsOpen(true)}><Settings size={21}/></button>
            <button className="icon-btn" onClick={stopLive}><VolumeX size={21}/></button>
          </div>
        </header>

        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow"><Sparkles size={16}/>Gemini Live Audio</span>
            <h1>{greeting}</h1>
            <p>{activeVoice ? 'المحادثة المباشرة شغالة. تكلم طبيعي، والصوت يجي من Gemini مباشرة.' : 'اضغط المايك مرة واحدة. أول مرة سيطلب Safari إذن الميكروفون فقط.'}</p>
          </div>
          <button className={`big-mic ${listening ? 'listening' : speaking ? 'speaking' : ''}`} onClick={toggleMic} aria-label="تشغيل أو إيقاف المحادثة الصوتية">
            {activeVoice ? <MicOff size={34}/> : <Mic size={34}/>}<span/>
          </button>
        </section>

        <div className="search-wrap">
          <Search size={19}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث في الأدوات والمشاريع…"/>
          {search && <button onClick={() => setSearch('')}><X size={17}/></button>}
          {search && <div className="search-popover">
            {results.length ? results.map(item => (
              <button key={`${item.type}-${item.id}`} onClick={() => {
                setSearch('');
                item.type === 'project' ? setProject(item.data) : useQuickAction(item.data);
              }}><b>{item.title}</b><span>{item.sub}</span></button>
            )) : <div className="no-result">ما لقيت شيء مطابق</div>}
          </div>}
        </div>

        <section className="quick-grid">
          {QUICK_ACTIONS.map(action => {
            const Icon = action.icon;
            return <button key={action.id} onClick={() => useQuickAction(action)}><span><Icon size={20}/></span><b>{action.title}</b></button>;
          })}
        </section>

        <section className="conversation-card">
          <div className="conversation-head">
            <div><b>المحادثة</b><span>{activeVoice ? 'Live صوت لصوت' : 'نص سريع'}{lastLatency != null ? ` • ${lastLatency}ms` : ''}</span></div>
            <button className="tiny-btn" onClick={() => {
              stopLive();
              const fresh = [{ role: 'assistant', text: 'بدأنا من جديد. وش تحتاج؟' }];
              messagesRef.current = fresh;
              setMessages(fresh);
            }}><RotateCcw size={16}/>جديد</button>
          </div>

          <div className="messages" ref={scrollRef}>
            {messages.map((m, i) => <div key={i} className={`message ${m.role}`}><div>{m.text}</div></div>)}
            {liveUserText && <div className="message user"><div>{liveUserText}</div></div>}
            {liveAssistantText && <div className="message assistant"><div>{liveAssistantText}</div></div>}
            {loading && <div className="message assistant"><div className="typing"><i/><i/><i/></div></div>}
          </div>

          {error && <div className="error-box">{error}</div>}

          <div className="composer">
            <textarea rows="1" value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTextMessage(); }
            }} placeholder={activeVoice ? 'المحادثة الصوتية شغالة… أو اكتب هنا' : 'اكتب أو اضغط المايك للمحادثة المباشرة…'}/>
            <button className={`composer-mic ${activeVoice ? 'active' : ''}`} onClick={toggleMic}>{activeVoice ? <MicOff size={23}/> : <Mic size={23}/>}</button>
            <button className="send-btn" disabled={!value.trim() || loading} onClick={sendTextMessage}><Send size={21}/></button>
          </div>
        </section>

        <section className="projects-block">
          <div className="section-head"><div><span>مشاريعي</span><h2>وصول مباشر</h2></div><MoreHorizontal size={22}/></div>
          <div className="projects-grid">
            {Object.entries(PROJECTS).map(([id, p]) => (
              <button className="project-card" key={id} onClick={() => setProject(p)}>
                <div className="project-mark">{p.letter}</div><div><b>{p.name}</b><span>{p.desc}</span></div><ExternalLink size={19}/>
              </button>
            ))}
          </div>
        </section>

        <footer className="footer-note"><Zap size={15}/>Gemini 3.1 Flash Live • صوت أصلي مباشر • بدون speechSynthesis</footer>
      </div>

      {settingsOpen && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setSettingsOpen(false)}/>} 
      {project && <ProjectPanel project={project} onClose={() => setProject(null)}/>} 
    </div>
  );
}
