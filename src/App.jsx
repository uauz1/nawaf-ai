import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Settings, ChevronLeft, X, Save, Send, RotateCcw, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

const actions = [
  { id:'ideas', emoji:'💡', title:'أفكار جديدة', sub:'اقتراحات تناسبك', prompt:'اكتب لي 5 أفكار جديدة ومناسبة لي' },
  { id:'solve', emoji:'⚡', title:'حل مشكلة', sub:'تحليل سريع وواضح', prompt:'ساعدني أحل المشكلة التالية:' },
  { id:'plans', emoji:'📋', title:'خطط ومشاريع', sub:'رتب يومك ومشاريعك', prompt:'رتب لي خطة واضحة للمشروع التالي:' },
  { id:'code', emoji:'⌨️', title:'مساعدة برمجية', sub:'كود وحلول تقنية', prompt:'ساعدني في الكود التالي:' },
];

const mascotModes = [
  { id:'idle', emoji:'😅' },
  { id:'wave', emoji:'👋' },
  { id:'think', emoji:'🤔' },
  { id:'happy', emoji:'😄' },
  { id:'sleepy', emoji:'😴' },
];

function pickNext(currentId) {
  const pool = mascotModes.filter((m) => m.id !== currentId);
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickSaudiFemaleVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const arabic = voices.filter((v) => /^ar([_-]|$)/i.test(v.lang));
  const saudi = arabic.filter((v) => /ar[-_]SA/i.test(v.lang));
  const femaleHints = /zariyah|hala|laila|layla|mariam|maryam|sara|female|أنثى/i;
  return saudi.find((v) => femaleHints.test(v.name)) ||
    arabic.find((v) => femaleHints.test(v.name)) ||
    saudi[0] || arabic[0] || voices.find((v) => /^ar/i.test(v.lang)) || null;
}

function speakSaudi(text) {
  if (!text || !('speechSynthesis' in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ar-SA';
  utterance.rate = 0.93;
  utterance.pitch = 1.08;
  utterance.volume = 1;
  const voice = pickSaudiFemaleVoice();
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
  return true;
}

function SettingsModal({ settings, setSettings, onClose }) {
  const toggle = (key) => setSettings((s) => ({ ...s, [key]: !s[key] }));
  const hasGeminiKey = Boolean(settings.geminiApiKey?.trim());

  return <div className="modal-backdrop" onClick={onClose}>
    <section className="sheet settings-sheet" onClick={(e) => e.stopPropagation()}>
      <div className="sheet-head"><div><small>Nawaf AI</small><h3>الإعدادات</h3></div><button onClick={onClose}><X/></button></div>

      <div className="api-key-card">
        <div className="api-key-head">
          <div><b>Gemini API Key</b><small>ألصق مفتاح Gemini هنا لتفعيل الذكاء الاصطناعي</small></div>
          <span className={hasGeminiKey ? 'key-status ready' : 'key-status'}>{hasGeminiKey ? 'مضاف' : 'غير مضاف'}</span>
        </div>
        <input type="password" value={settings.geminiApiKey || ''} onChange={(e) => setSettings((s) => ({ ...s, geminiApiKey: e.target.value }))} placeholder="AIza..." autoComplete="off" spellCheck="false" dir="ltr" />
        <small className="key-note">المفتاح محفوظ على هذا الجهاز فقط، ولن يظهر كنص واضح داخل الخانة.</small>
      </div>

      <div className="settings-list">
        <button onClick={() => toggle('voiceReplies')}><span><b>الرد بالصوت</b><small>صوت عربي أنثوي بلهجة سعودية عند توفره على جهازك</small></span><i className={settings.voiceReplies?'switch on':'switch'}><em/></i></button>
        <button onClick={() => toggle('rain')}><span><b>تأثير المطر</b><small>إظهار المطر فوق الخلفية</small></span><i className={settings.rain?'switch on':'switch'}><em/></i></button>
        <button onClick={() => toggle('autoMascot')}><span><b>حركة الشخصية تلقائيًا</b><small>تتغير حالتها كل 8 ثواني</small></span><i className={settings.autoMascot?'switch on':'switch'}><em/></i></button>
        <button onClick={() => toggle('motion')}><span><b>الحركات والأنيميشن</b><small>تفعيل الحركات الخفيفة</small></span><i className={settings.motion?'switch on':'switch'}><em/></i></button>
        <button onClick={() => toggle('darkOverlay')}><span><b>تعتيم الخلفية</b><small>يزيد وضوح النص والبطاقات</small></span><i className={settings.darkOverlay?'switch on':'switch'}><em/></i></button>
      </div>
      <div className="sheet-actions"><button className="secondary" onClick={() => setSettings((s) => ({...s,rain:true,autoMascot:true,motion:true,darkOverlay:true,voiceReplies:true}))}><RotateCcw size={18}/>افتراضي</button><button className="primary" onClick={onClose}><Save size={18}/>حفظ</button></div>
    </section>
  </div>
}

function ActionSheet({ action, onClose, apiKey, voiceReplies }) {
  const [value, setValue] = useState(action?.prompt || '');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const recognitionRef = useRef(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop?.();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

  if (!action) return null;

  const startListening = () => {
    if (listening) {
      recognitionRef.current?.stop?.();
      setListening(false);
      return;
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceSupported(false);
      setError('الميكروفون الصوتي غير مدعوم في هذا المتصفح. جرّبه من Safari أو Chrome بعد السماح بالمايك.');
      return;
    }
    setVoiceSupported(true);
    setError('');
    const recognition = new Recognition();
    recognition.lang = 'ar-SA';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = (event) => {
      setListening(false);
      if (event?.error === 'not-allowed') setError('اسمح للموقع باستخدام الميكروفون من إعدادات المتصفح ثم جرّب مرة ثانية.');
      else setError('تعذر تشغيل الميكروفون، جرّب مرة ثانية.');
    };
    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      if (transcript.trim()) setValue(transcript.trim());
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const run = async () => {
    const message = value.trim();
    if (!message || loading) return;
    setLoading(true);
    setAnswer('');
    setError('');
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, apiKey: apiKey?.trim() || undefined })
      });
      const data = await response.json();
      if (!response.ok) {
        if (data?.code === 'MISSING_API_KEY') throw new Error('أضف مفتاح Gemini من الإعدادات أولًا.');
        throw new Error(data?.error || 'تعذر الحصول على رد');
      }
      setAnswer(data.text);
      if (voiceReplies) speakSaudi(data.text);
    } catch (err) {
      setError(err.message || 'تعذر الاتصال بالذكاء الاصطناعي');
    } finally {
      setLoading(false);
    }
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  };

  return <div className="modal-backdrop" onClick={onClose}>
    <section className="sheet action-sheet" onClick={(e) => e.stopPropagation()}>
      <div className="sheet-head"><div><small>{action.emoji}</small><h3>{action.title}</h3></div><button onClick={onClose}><X/></button></div>
      <div className="voice-composer">
        <textarea value={value} onChange={(e) => setValue(e.target.value)} placeholder="اكتب طلبك هنا أو اضغط المايك وتكلم..." />
        <button className={listening ? 'mic-btn listening' : 'mic-btn'} onClick={startListening} aria-label="الميكروفون" title="تكلم باللهجة السعودية">{listening ? <MicOff size={24}/> : <Mic size={24}/>}</button>
      </div>
      {listening && <div className="listening-note">🎙️ أسمعك الآن... تكلم بشكل طبيعي</div>}
      {!voiceSupported && <div className="listening-note warning">الميكروفون غير مدعوم في هذا المتصفح.</div>}
      <button className="run-btn" onClick={run} disabled={loading || !value.trim()}><Send size={18}/>{loading?'قاعد أفكر...':'ابدأ'}</button>
      {error && <div className="demo-answer ai-error">{error}</div>}
      {answer && <div className="demo-answer ai-answer"><div className="answer-voice-bar"><button onClick={() => speakSaudi(answer)}><Volume2 size={18}/> اسمع الرد</button><button onClick={stopSpeaking}><VolumeX size={18}/> إيقاف</button></div>{answer}</div>}
    </section>
  </div>
}

function ProjectSheet({ project, onClose }) {
  if (!project) return null;
  return <div className="modal-backdrop" onClick={onClose}>
    <section className="sheet project-sheet" onClick={(e) => e.stopPropagation()}>
      <div className="sheet-head"><div><small>مشروع</small><h3>{project.name}</h3></div><button onClick={onClose}><X/></button></div>
      <div className={`big-project-logo ${project.color}`}>{project.letter}</div>
      <p>{project.desc}</p>
      <div className="project-status"><span>الحالة</span><b>قيد التطوير</b></div>
      <button className="run-btn" onClick={onClose}>رجوع للرئيسية</button>
    </section>
  </div>
}

export default function App() {
  const [mascotMode, setMascotMode] = useState(mascotModes[0]);
  const [reaction, setReaction] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const [project, setProject] = useState(null);
  const [search, setSearch] = useState('');
  const [settings, setSettings] = useState(() => {
    const defaults = {rain:true,autoMascot:true,motion:true,darkOverlay:true,geminiApiKey:'',voiceReplies:true};
    try { return { ...defaults, ...(JSON.parse(localStorage.getItem('nawaf-settings')) || {}) }; }
    catch { return defaults; }
  });

  useEffect(() => { localStorage.setItem('nawaf-settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => {
    if (!settings.autoMascot) return;
    const timer = setInterval(() => setMascotMode((current) => pickNext(current.id)), 8000);
    return () => clearInterval(timer);
  }, [settings.autoMascot]);
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
  }, []);

  const interactMascot = () => {
    const reactions = ['👋','😂','✨','🤨','😎','💡'];
    setReaction(reactions[Math.floor(Math.random() * reactions.length)]);
    setMascotMode((current) => pickNext(current.id));
    window.setTimeout(() => setReaction(''), 1300);
  };

  const greeting = useMemo(() => new Date().getHours() < 12 ? 'صباح الخير يا نواف ☀️' : 'مساء الخير يا نواف 🌙', []);
  const projectData = {
    mueen:{name:'مُعين',letter:'م',color:'green',desc:'تطبيق إسلامي شامل: قرآن، صلاة، أذكار، قبلة ومزايا أخرى.'},
    qadha:{name:'قدّها',letter:'ق',color:'purple',desc:'منصة ألعاب جماعية للمنافسات والتحديات بين الأصدقاء.'}
  };
  const normalized = search.trim().toLowerCase();
  const matches = normalized ? [
    ...actions.filter((a) => (a.title+a.sub).toLowerCase().includes(normalized)),
    ...(normalized.includes('معين')||normalized.includes('مُعين')?[{id:'mueen',title:'مُعين',sub:'مشروع'}]:[]),
    ...(normalized.includes('قد')?[{id:'qadha',title:'قدّها',sub:'مشروع'}]:[])
  ] : [];

  return <div className={`page ${settings.motion?'motion-on':'motion-off'} ${settings.darkOverlay?'overlay-on':'overlay-off'}`} dir="rtl">
    <div className="backdrop-photo"/><div className="page-overlay"/>{settings.rain&&<div className="rain-layer"/>}
    <main className="mobile-shell">
      <header className="top-search">
        <div className="search-box"><Search size={24}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="ابحث في مشاريعك وملاحظاتك..."/></div>
        <button className="settings-btn" aria-label="الإعدادات" onClick={()=>setSettingsOpen(true)}><Settings size={24}/></button>
      </header>
      {normalized&&<div className="search-results">{matches.length?matches.map((item)=><button key={item.id} onClick={()=>item.id==='mueen'||item.id==='qadha'?setProject(projectData[item.id]):setActiveAction(actions.find((a)=>a.id===item.id))}><b>{item.title}</b><span>{item.sub}</span></button>):<div>ما لقيت نتيجة مطابقة</div>}</div>}
      <section className="hero-card">
        <div className="hero-bg"/><div className="hero-shade"/>
        <div className="change-pill">{settings.autoMascot?'يتغير كل 8 ثواني':'الحركة التلقائية متوقفة'}</div>
        <div className="hero-copy"><div className="greeting">{greeting}</div><h1>كيف أقدر أساعدك اليوم؟</h1><p>الأحد، ٢٤ ربيع الأول، ١٤٤٨ هـ</p></div>
        <button className={`mascot-placeholder mascot-${mascotMode.id}`} onClick={interactMascot} aria-label="التفاعل مع الشخصية"><div className="reaction">{reaction||mascotMode.emoji}</div><div className="boy-head"><span/></div><div className="boy-body"><i/></div></button>
      </section>
      <section className="action-grid">{actions.map((action)=><button key={action.id} className="action-card" onClick={()=>setActiveAction(action)}><span className="action-emoji">{action.emoji}</span><strong>{action.title}</strong><span className="action-sub">{action.sub}</span></button>)}</section>
      <section className="projects-section"><h2>مشاريعي</h2><div className="projects-grid">
        <article className="project-card"><div className="project-logo green">م</div><div className="project-info"><strong>مُعين</strong><span>تطبيق<br/>إسلامي<br/>شامل</span></div><button onClick={()=>setProject(projectData.mueen)}>راجع<br/>المشروع</button></article>
        <article className="project-card"><div className="project-logo purple">ق</div><div className="project-info"><strong>قدّها</strong><span>منصة<br/>ألعاب<br/>جماعية</span></div><button onClick={()=>setProject(projectData.qadha)}>راجع<br/>المشروع</button></article>
      </div></section>
      <section className="help-card"><div><h3>كيف أقدر أساعدك الآن؟</h3><p>اكتب أو تكلم، وأنا أرد عليك نص وصوت.</p></div><button onClick={()=>setActiveAction({id:'ask',emoji:'💬',title:'اسأل Nawaf AI',sub:'ابدأ طلب جديد',prompt:''})}><ChevronLeft/></button></section>
    </main>
    {settingsOpen&&<SettingsModal settings={settings} setSettings={setSettings} onClose={()=>setSettingsOpen(false)}/>} 
    {activeAction&&<ActionSheet action={activeAction} apiKey={settings.geminiApiKey} voiceReplies={settings.voiceReplies} onClose={()=>setActiveAction(null)}/>} 
    {project&&<ProjectSheet project={project} onClose={()=>setProject(null)}/>} 
  </div>;
}
