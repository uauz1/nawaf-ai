import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Settings, ChevronLeft, X, Save, Send, RotateCcw, Mic, MicOff, VolumeX, ExternalLink, LayoutDashboard } from 'lucide-react';

const actions = [
  { id:'ideas', emoji:'💡', title:'أفكار جديدة', sub:'اقتراحات تناسبك', prompt:'اكتب لي 5 أفكار جديدة ومناسبة لي' },
  { id:'solve', emoji:'⚡', title:'حل مشكلة', sub:'تحليل سريع وواضح', prompt:'ساعدني أحل المشكلة التالية:' },
  { id:'plans', emoji:'📋', title:'خطط ومشاريع', sub:'رتب يومك ومشاريعك', prompt:'رتب لي خطة واضحة للمشروع التالي:' },
  { id:'code', emoji:'⌨️', title:'مساعدة برمجية', sub:'كود وحلول تقنية', prompt:'ساعدني في الكود التالي:' },
];

const projectData = {
  mueen:{
    id:'mueen', name:'مُعين', letter:'م', color:'green',
    desc:'تطبيق إسلامي شامل: قرآن، صلاة، أذكار، قبلة ومزايا أخرى.',
    repo:'https://github.com/uauz1/mueen-islamic-app',
    stats:[['المنصة','Android / Web'],['الحالة','قيد التطوير'],['الأولوية','إصلاحات ما قبل النشر']]
  },
  qadha:{
    id:'qadha', name:'قدّها', letter:'ق', color:'purple',
    desc:'منصة ألعاب جماعية للمنافسات والتحديات بين الأصدقاء.',
    repo:'https://github.com/uauz1/game',
    app:'https://qadha-games.uauz99.chatgpt.site/',
    stats:[['المنصة','Web'],['الحالة','قيد التطوير'],['الأولوية','إكمال الألعاب وتشغيلها']]
  }
};

let activeAudio = null;
let audioGeneration = 0;

function stopAllSpeech() {
  audioGeneration += 1;
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.src = '';
    activeAudio = null;
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

function pickSaudiFemaleVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const arabic = voices.filter(v => /^ar([_-]|$)/i.test(v.lang));
  const saudi = arabic.filter(v => /ar[-_]SA/i.test(v.lang));
  const femaleHints = /zariyah|hala|laila|layla|mariam|maryam|sara|salma|female|أنثى/i;
  return saudi.find(v => femaleHints.test(v.name)) || arabic.find(v => femaleHints.test(v.name)) || saudi[0] || arabic[0] || null;
}

function speakDeviceFallback(text, onEnd) {
  if (!text || !('speechSynthesis' in window)) { onEnd?.(); return false; }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ar-SA';
  u.rate = 1.08;
  u.pitch = 1.1;
  u.volume = 1;
  const voice = pickSaudiFemaleVoice();
  if (voice) u.voice = voice;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
  return true;
}

async function fetchGeminiAudio(text, apiKey) {
  const response = await fetch('/api/tts', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ text, apiKey:apiKey?.trim() || undefined })
  });
  const data = await response.json();
  if (!response.ok || !data?.audioBase64) throw new Error(data?.error || 'تعذر توليد الصوت');
  return data;
}

function splitForFastSpeech(text) {
  const cleaned = String(text || '').replace(/\[IMAGE_REQUEST\]/g,'').trim();
  if (!cleaned) return [];
  const words = cleaned.split(/\s+/);
  if (words.length <= 10) return [cleaned];
  const first = words.slice(0,10).join(' ');
  const rest = words.slice(10).join(' ');
  return [first, rest].filter(Boolean);
}

async function speakGeminiSaudiFast(text, apiKey, onEnd, onFallback) {
  if (!text) { onEnd?.(); return; }
  stopAllSpeech();
  const generation = audioGeneration;
  const parts = splitForFastSpeech(text);
  if (!parts.length) { onEnd?.(); return; }
  try {
    const firstPromise = fetchGeminiAudio(parts[0], apiKey);
    const restPromise = parts[1] ? fetchGeminiAudio(parts[1], apiKey).catch(()=>null) : Promise.resolve(null);
    const first = await firstPromise;
    if (generation !== audioGeneration) return;

    const playData = data => new Promise((resolve, reject) => {
      if (!data || generation !== audioGeneration) return resolve();
      const audio = new Audio(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
      activeAudio = audio;
      audio.preload = 'auto';
      audio.onended = () => { if (activeAudio === audio) activeAudio = null; resolve(); };
      audio.onerror = () => { if (activeAudio === audio) activeAudio = null; reject(new Error('audio playback failed')); };
      audio.play().catch(reject);
    });

    await playData(first);
    const rest = await restPromise;
    if (rest && generation === audioGeneration) await playData(rest);
    if (generation === audioGeneration) onEnd?.();
  } catch (error) {
    if (generation !== audioGeneration) return;
    onFallback?.(error);
  }
}

function extractUrl(text) {
  const match = String(text || '').match(/https?:\/\/[^\s)\]}>,]+/i);
  return match ? match[0].replace(/[.,،؛]+$/,'') : '';
}

function maybeDirectOpen(message, reply) {
  const wantsOpen = /(افتح|فتح|ودني|روح|الرابط|لينك)/i.test(message || '');
  if (!wantsOpen) return false;
  let url = extractUrl(message) || extractUrl(reply);
  if (!url && /(قد.?ها|قدها)/i.test(message || '')) url = projectData.qadha.app;
  if (!url && /(مُ?عين|معين)/i.test(message || '')) url = projectData.mueen.repo;
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

function SettingsModal({ settings, setSettings, onClose }) {
  const toggle = key => setSettings(s => ({...s,[key]:!s[key]}));
  const hasKey = Boolean(settings.geminiApiKey?.trim());
  return <div className="modal-backdrop" onClick={onClose}>
    <section className="sheet settings-sheet" onClick={e=>e.stopPropagation()}>
      <div className="sheet-head"><div><small>Nawaf AI</small><h3>الإعدادات</h3></div><button onClick={onClose}><X/></button></div>
      <div className="api-key-card">
        <div className="api-key-head"><div><b>Gemini API Key</b><small>مفتاح الذكاء الاصطناعي والصوت الاحترافي</small></div><span className={hasKey?'key-status ready':'key-status'}>{hasKey?'مضاف':'غير مضاف'}</span></div>
        <input type="password" value={settings.geminiApiKey||''} onChange={e=>setSettings(s=>({...s,geminiApiKey:e.target.value}))} placeholder="AIza..." dir="ltr" autoComplete="off"/>
      </div>
      <div className="settings-list">
        <button onClick={()=>toggle('voiceReplies')}><span><b>الرد بالصوت</b><small>نفس صوت Gemini الحالي لكن يبدأ أسرع</small></span><i className={settings.voiceReplies?'switch on':'switch'}><em/></i></button>
        <button onClick={()=>toggle('continuousVoice')}><span><b>محادثة صوتية مستمرة</b><small>يرد ثم يرجع يسمعك تلقائيًا بدون ضغط جديد</small></span><i className={settings.continuousVoice?'switch on':'switch'}><em/></i></button>
        <button onClick={()=>toggle('rain')}><span><b>تأثير المطر</b><small>مطر أوضح وأنعم فوق الخلفية</small></span><i className={settings.rain?'switch on':'switch'}><em/></i></button>
        <button onClick={()=>toggle('motion')}><span><b>الحركات والأنيميشن</b><small>تفعيل الحركات الخفيفة</small></span><i className={settings.motion?'switch on':'switch'}><em/></i></button>
      </div>
      <div className="sheet-actions"><button className="secondary" onClick={()=>setSettings(s=>({...s,voiceReplies:true,continuousVoice:true,rain:true,motion:true,darkOverlay:true}))}><RotateCcw size={18}/>افتراضي</button><button className="primary" onClick={onClose}><Save size={18}/>حفظ</button></div>
    </section>
  </div>
}

function ConversationSheet({ action, onClose, apiKey, voiceReplies, continuousVoice }) {
  const [value,setValue]=useState(action?.prompt||'');
  const [messages,setMessages]=useState([]);
  const [loading,setLoading]=useState(false);
  const [listening,setListening]=useState(false);
  const [speaking,setSpeaking]=useState(false);
  const [error,setError]=useState('');
  const recognitionRef=useRef(null);
  const restartRef=useRef(false);
  const retryTimerRef=useRef(null);
  const loadingRef=useRef(false);
  const speakingRef=useRef(false);
  const messagesRef=useRef([]);

  useEffect(()=>{ loadingRef.current=loading; },[loading]);
  useEffect(()=>{ speakingRef.current=speaking; },[speaking]);
  useEffect(()=>{ messagesRef.current=messages; },[messages]);

  const clearRetry=()=>{
    if(retryTimerRef.current){clearTimeout(retryTimerRef.current);retryTimerRef.current=null;}
  };

  const stopVoice=()=>{
    restartRef.current=false;
    clearRetry();
    try{recognitionRef.current?.abort?.();}catch{}
    recognitionRef.current=null;
    stopAllSpeech();
    setListening(false); setSpeaking(false);
  };

  useEffect(()=>()=>stopVoice(),[]);

  const scheduleListeningRestart=(delay=220)=>{
    clearRetry();
    if(!continuousVoice||!restartRef.current||loadingRef.current||speakingRef.current)return;
    retryTimerRef.current=setTimeout(()=>{
      if(continuousVoice&&restartRef.current&&!loadingRef.current&&!speakingRef.current) beginListening(true);
    },delay);
  };

  const beginListening=(automatic=false)=>{
    const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!Recognition){
      setError('المحادثة الصوتية غير مدعومة في هذا المتصفح. افتح الموقع من Safari أو Chrome واسمح للمايك.');
      restartRef.current=false;
      return;
    }
    if(listening||loadingRef.current||speakingRef.current)return;
    clearRetry();
    stopAllSpeech();
    try{recognitionRef.current?.abort?.();}catch{}

    const r=new Recognition();
    r.lang='ar-SA';
    r.interimResults=true;
    r.continuous=false;
    r.maxAlternatives=1;
    let finalText='';
    let gotSpeech=false;
    let hadFatalError=false;

    r.onstart=()=>{
      setListening(true);
      setSpeaking(false);
      setError('');
      restartRef.current=true;
    };
    r.onspeechstart=()=>{gotSpeech=true;};
    r.onresult=e=>{
      let live='';
      for(let i=e.resultIndex;i<e.results.length;i++){
        const t=e.results[i][0].transcript;
        if(e.results[i].isFinal) finalText+=t+' '; else live+=t;
      }
      if((finalText+live).trim())gotSpeech=true;
      setValue((finalText+live).trim());
    };
    r.onerror=e=>{
      setListening(false);
      const code=e?.error;
      if(code==='not-allowed'||code==='service-not-allowed'){
        hadFatalError=true;
        restartRef.current=false;
        setError('اسمح للموقع باستخدام الميكروفون ثم جرّب مرة ثانية.');
      }else if(code==='audio-capture'){
        hadFatalError=true;
        restartRef.current=false;
        setError('تعذر الوصول للمايك. تأكد أن المتصفح مسموح له باستخدام الميكروفون.');
      }
    };
    r.onend=()=>{
      setListening(false);
      if(recognitionRef.current===r)recognitionRef.current=null;
      const text=finalText.trim();
      if(text){
        sendMessage(text,true);
        return;
      }
      if(!hadFatalError&&restartRef.current&&continuousVoice){
        scheduleListeningRestart(gotSpeech?180:(automatic?350:260));
      }
    };
    recognitionRef.current=r;
    restartRef.current=true;
    try{r.start();}
    catch(err){
      recognitionRef.current=null;
      setListening(false);
      if(automatic&&continuousVoice&&restartRef.current)scheduleListeningRestart(450);
      else setError('تعذر بدء الاستماع. جرّب مرة ثانية.');
    }
  };

  const finishSpeaking=()=>{
    setSpeaking(false);
    speakingRef.current=false;
    if(continuousVoice&&restartRef.current) scheduleListeningRestart(180);
  };

  const speakReply=(text)=>{
    setSpeaking(true);
    speakingRef.current=true;
    speakGeminiSaudiFast(text, apiKey, finishSpeaking, ()=>{
      speakDeviceFallback(String(text).replace(/\[IMAGE_REQUEST\]/g,''), finishSpeaking);
    });
  };

  const sendMessage=async(forcedText,fromVoice=false)=>{
    const message=(forcedText ?? value).trim();
    if(!message||loadingRef.current)return;
    clearRetry();
    try{recognitionRef.current?.abort?.();}catch{}
    recognitionRef.current=null;
    setListening(false);
    const directUrl = extractUrl(message);
    if (directUrl && /(افتح|فتح|ودني|روح)/i.test(message)) window.open(directUrl,'_blank','noopener,noreferrer');
    const nextHistory=[...messagesRef.current,{role:'user',text:message}];
    setMessages(nextHistory);
    messagesRef.current=nextHistory;
    setValue('');
    setLoading(true);
    loadingRef.current=true;
    setError('');
    try{
      const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,history:nextHistory.slice(-20),apiKey:apiKey?.trim()||undefined})});
      const data=await response.json();
      if(!response.ok) throw new Error(data?.error||'تعذر الحصول على رد');
      const cleanText=String(data.text||'').replace(/^\[IMAGE_REQUEST\]\s*/,'').trim();
      const withReply=[...nextHistory,{role:'assistant',text:cleanText}];
      setMessages(withReply);
      messagesRef.current=withReply;
      maybeDirectOpen(message, data.text);
      if(voiceReplies||fromVoice) speakReply(cleanText);
      else if(continuousVoice&&fromVoice&&restartRef.current) scheduleListeningRestart(180);
    }catch(err){
      setError(err.message||'تعذر الاتصال بالذكاء الاصطناعي');
      if(continuousVoice&&fromVoice&&restartRef.current) scheduleListeningRestart(700);
    }finally{
      setLoading(false);
      loadingRef.current=false;
    }
  };

  const toggleListening=()=> listening?stopVoice():beginListening(false);

  return <div className="modal-backdrop" onClick={onClose}>
    <section className="sheet action-sheet chat-sheet" onClick={e=>e.stopPropagation()}>
      <div className="sheet-head"><div><small>{action.emoji}</small><h3>{action.title}</h3></div><button onClick={onClose}><X/></button></div>
      <div className="voice-state"><span className={listening?'dot live':speaking?'dot speaking':'dot'}></span>{listening?'أسمعك الآن...':speaking?'قاعد أرد عليك...':loading?'أفكر وأجهز الرد...':continuousVoice&&restartRef.current?'برجع أسمعك تلقائيًا':'المحادثة الصوتية جاهزة'}</div>
      <div className="chat-messages">
        {!messages.length&&<div className="chat-empty">اضغط المايك مرة واحدة وابدأ. بعدها أرد عليك صوتيًا وأرجع أسمعك تلقائيًا بدون ضغط جديد.</div>}
        {messages.map((m,i)=><div key={i} className={`bubble ${m.role}`}>{m.text}</div>)}
        {loading&&<div className="bubble assistant typing">أفكر...</div>}
      </div>
      <div className="voice-composer modern-composer">
        <textarea value={value} onChange={e=>setValue(e.target.value)} placeholder="اكتب أو اضغط المايك وتكلم..."/>
        <button className={listening?'mic-btn listening':'mic-btn'} onClick={toggleListening}>{listening?<MicOff/>:<Mic/>}</button>
      </div>
      <div className="composer-actions"><button className="run-btn" onClick={()=>sendMessage()} disabled={loading||!value.trim()}><Send size={18}/>إرسال</button><button className="voice-stop" onClick={stopVoice}><VolumeX size={18}/>إيقاف الصوت</button></div>
      {error&&<div className="demo-answer ai-error">{error}</div>}
    </section>
  </div>
}

function ProjectDashboard({project,onClose}){
  if(!project)return null;
  const openUrl=url=>window.open(url,'_blank','noopener,noreferrer');
  return <div className="modal-backdrop" onClick={onClose}><section className="sheet project-dashboard" onClick={e=>e.stopPropagation()}>
    <div className="sheet-head"><div><small>لوحة التحكم</small><h3>{project.name}</h3></div><button onClick={onClose}><X/></button></div>
    <div className="dashboard-hero"><div className={`big-project-logo ${project.color}`}>{project.letter}</div><div><h2>{project.name}</h2><p>{project.desc}</p></div></div>
    <div className="dashboard-stats">{project.stats.map(([k,v])=><div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
    <div className="dashboard-actions">
      {project.app&&<button className="primary-dash" onClick={()=>openUrl(project.app)}><ExternalLink size={19}/>فتح {project.name} في المتصفح</button>}
      <button onClick={()=>openUrl(project.repo)}><LayoutDashboard size={19}/>فتح ملفات المشروع على GitHub</button>
    </div>
  </section></div>;
}

export default function App(){
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [activeAction,setActiveAction]=useState(null);
  const [project,setProject]=useState(null);
  const [search,setSearch]=useState('');
  const [settings,setSettings]=useState(()=>{
    const defaults={rain:true,motion:true,darkOverlay:true,geminiApiKey:'',voiceReplies:true,continuousVoice:true};
    try{return {...defaults,...(JSON.parse(localStorage.getItem('nawaf-settings'))||{})};}catch{return defaults;}
  });
  useEffect(()=>localStorage.setItem('nawaf-settings',JSON.stringify(settings)),[settings]);
  useEffect(()=>{if('speechSynthesis'in window){window.speechSynthesis.getVoices();window.speechSynthesis.onvoiceschanged=()=>window.speechSynthesis.getVoices();}},[]);
  const greeting=useMemo(()=>new Date().getHours()<12?'صباح الخير يا نواف ☀️':'مساء الخير يا نواف 🌙',[]);
  const normalized=search.trim().toLowerCase();
  const matches=normalized?[...actions.filter(a=>(a.title+a.sub).toLowerCase().includes(normalized)),...(normalized.includes('معين')||normalized.includes('مُعين')?[{id:'mueen',title:'مُعين',sub:'مشروع'}]:[]),...(normalized.includes('قد')?[{id:'qadha',title:'قدّها',sub:'مشروع'}]:[])]:[];
  const openProject=id=>setProject(projectData[id]);

  return <div className={`page ${settings.motion?'motion-on':'motion-off'} ${settings.darkOverlay?'overlay-on':'overlay-off'}`} dir="rtl">
    <div className="backdrop-photo"/><div className="page-overlay"/>{settings.rain&&<div className="rain-layer"><i/><i/><i/></div>}
    <main className="mobile-shell">
      <header className="top-search"><div className="search-box"><Search size={24}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث في مشاريعك وملاحظاتك..."/></div><button className="settings-btn" onClick={()=>setSettingsOpen(true)}><Settings size={24}/></button></header>
      {normalized&&<div className="search-results">{matches.length?matches.map(item=><button key={item.id} onClick={()=>item.id==='mueen'||item.id==='qadha'?openProject(item.id):setActiveAction(actions.find(a=>a.id===item.id))}><b>{item.title}</b><span>{item.sub}</span></button>):<div>ما لقيت نتيجة مطابقة</div>}</div>}
      <section className="hero-card"><div className="hero-bg"/><div className="hero-shade"/><div className="change-pill">مساعدك الشخصي • أسرع</div><div className="hero-copy"><div className="greeting">{greeting}</div><h1>كيف أقدر أساعدك اليوم؟</h1><p>تكلم معي، افتح رابط، أو خلني أساعدك في مشروعك</p></div><button className="mascot-placeholder mascot-idle" onClick={()=>setActiveAction({id:'voice',emoji:'🎙️',title:'محادثة صوتية',sub:'',prompt:''})}><div className="reaction">🎙️</div><div className="boy-head"><span/></div><div className="boy-body"><i/></div></button></section>
      <section className="action-grid">{actions.map(a=><button key={a.id} className="action-card" onClick={()=>setActiveAction(a)}><span className="action-emoji">{a.emoji}</span><strong>{a.title}</strong><span className="action-sub">{a.sub}</span></button>)}</section>
      <section className="projects-section"><h2>مشاريعي</h2><div className="projects-grid">
        <article className="project-card clickable-project" onClick={()=>openProject('mueen')}><div className="project-logo green">م</div><div className="project-info"><strong>مُعين</strong><span>لوحة تحكم المشروع</span></div><button>فتح</button></article>
        <article className="project-card clickable-project" onClick={()=>openProject('qadha')}><div className="project-logo purple">ق</div><div className="project-info"><strong>قدّها</strong><span>لوحة تحكم + فتح الموقع</span></div><button>فتح</button></article>
      </div></section>
      <section className="help-card"><div><h3>محادثة مباشرة</h3><p>رد صوتي أسرع، ذكاء أعلى، وتنفيذ مباشر للروابط.</p></div><button onClick={()=>setActiveAction({id:'ask',emoji:'🎙️',title:'محادثة مع Nawaf AI',sub:'',prompt:''})}><ChevronLeft/></button></section>
    </main>
    {settingsOpen&&<SettingsModal settings={settings} setSettings={setSettings} onClose={()=>setSettingsOpen(false)}/>} 
    {activeAction&&<ConversationSheet action={activeAction} apiKey={settings.geminiApiKey} voiceReplies={settings.voiceReplies} continuousVoice={settings.continuousVoice} onClose={()=>setActiveAction(null)}/>} 
    {project&&<ProjectDashboard project={project} onClose={()=>setProject(null)}/>} 
  </div>;
}