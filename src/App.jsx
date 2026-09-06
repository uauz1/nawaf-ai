import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Settings, ChevronLeft, X, Save, Send, RotateCcw, Mic, MicOff, Volume2, VolumeX, ExternalLink, LayoutDashboard } from 'lucide-react';

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

function pickSaudiFemaleVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const arabic = voices.filter(v => /^ar([_-]|$)/i.test(v.lang));
  const saudi = arabic.filter(v => /ar[-_]SA/i.test(v.lang));
  const femaleHints = /zariyah|hala|laila|layla|mariam|maryam|sara|salma|female|أنثى/i;
  return saudi.find(v => femaleHints.test(v.name)) || arabic.find(v => femaleHints.test(v.name)) || saudi[0] || arabic[0] || null;
}

function speakSaudi(text, onEnd) {
  if (!text || !('speechSynthesis' in window)) { onEnd?.(); return false; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ar-SA';
  u.rate = 1.02;
  u.pitch = 1.12;
  u.volume = 1;
  const voice = pickSaudiFemaleVoice();
  if (voice) u.voice = voice;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
  return true;
}

function SettingsModal({ settings, setSettings, onClose }) {
  const toggle = key => setSettings(s => ({...s,[key]:!s[key]}));
  const hasKey = Boolean(settings.geminiApiKey?.trim());
  return <div className="modal-backdrop" onClick={onClose}>
    <section className="sheet settings-sheet" onClick={e=>e.stopPropagation()}>
      <div className="sheet-head"><div><small>Nawaf AI</small><h3>الإعدادات</h3></div><button onClick={onClose}><X/></button></div>
      <div className="api-key-card">
        <div className="api-key-head"><div><b>Gemini API Key</b><small>مفتاح الذكاء الاصطناعي</small></div><span className={hasKey?'key-status ready':'key-status'}>{hasKey?'مضاف':'غير مضاف'}</span></div>
        <input type="password" value={settings.geminiApiKey||''} onChange={e=>setSettings(s=>({...s,geminiApiKey:e.target.value}))} placeholder="AIza..." dir="ltr" autoComplete="off"/>
      </div>
      <div className="settings-list">
        <button onClick={()=>toggle('voiceReplies')}><span><b>الرد بالصوت</b><small>قراءة ردود المساعد بصوت أنثوي عربي</small></span><i className={settings.voiceReplies?'switch on':'switch'}><em/></i></button>
        <button onClick={()=>toggle('continuousVoice')}><span><b>محادثة صوتية مستمرة</b><small>بعد ما تخلص كلامك يرد تلقائيًا ثم يرجع يسمعك</small></span><i className={settings.continuousVoice?'switch on':'switch'}><em/></i></button>
        <button onClick={()=>toggle('rain')}><span><b>تأثير المطر</b><small>إظهار المطر فوق الخلفية</small></span><i className={settings.rain?'switch on':'switch'}><em/></i></button>
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

  const stopVoice=()=>{
    restartRef.current=false;
    recognitionRef.current?.stop?.();
    if('speechSynthesis' in window) window.speechSynthesis.cancel();
    setListening(false); setSpeaking(false);
  };

  useEffect(()=>()=>stopVoice(),[]);

  const beginListening=()=>{
    const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!Recognition){setError('المحادثة الصوتية غير مدعومة في هذا المتصفح. افتح الموقع من Safari أو Chrome واسمح للمايك.');return;}
    if('speechSynthesis' in window) window.speechSynthesis.cancel();
    const r=new Recognition();
    r.lang='ar-SA'; r.interimResults=true; r.continuous=false;
    let finalText='';
    r.onstart=()=>{setListening(true);setSpeaking(false);setError('');};
    r.onresult=e=>{
      let live='';
      for(let i=e.resultIndex;i<e.results.length;i++){
        const t=e.results[i][0].transcript;
        if(e.results[i].isFinal) finalText+=t+' '; else live+=t;
      }
      setValue((finalText+live).trim());
    };
    r.onerror=e=>{setListening(false); if(e?.error==='not-allowed')setError('اسمح للموقع باستخدام الميكروفون ثم جرّب مرة ثانية.');};
    r.onend=()=>{
      setListening(false);
      const text=finalText.trim();
      if(text) sendMessage(text,true);
    };
    recognitionRef.current=r;
    restartRef.current=true;
    r.start();
  };

  const sendMessage=async(forcedText,fromVoice=false)=>{
    const message=(forcedText ?? value).trim();
    if(!message||loading)return;
    if(recognitionRef.current) recognitionRef.current.stop?.();
    const nextHistory=[...messages,{role:'user',text:message}];
    setMessages(nextHistory); setValue(''); setLoading(true); setError('');
    try{
      const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,history:nextHistory.slice(-16),apiKey:apiKey?.trim()||undefined})});
      const data=await response.json();
      if(!response.ok) throw new Error(data?.error||'تعذر الحصول على رد');
      const withReply=[...nextHistory,{role:'assistant',text:data.text}];
      setMessages(withReply);
      if(voiceReplies||fromVoice){
        setSpeaking(true);
        speakSaudi(data.text,()=>{
          setSpeaking(false);
          if(continuousVoice&&restartRef.current) setTimeout(beginListening,250);
        });
      } else if(continuousVoice&&fromVoice&&restartRef.current){
        setTimeout(beginListening,250);
      }
    }catch(err){setError(err.message||'تعذر الاتصال بالذكاء الاصطناعي');}
    finally{setLoading(false);}
  };

  const toggleListening=()=> listening?stopVoice():beginListening();

  return <div className="modal-backdrop" onClick={onClose}>
    <section className="sheet action-sheet chat-sheet" onClick={e=>e.stopPropagation()}>
      <div className="sheet-head"><div><small>{action.emoji}</small><h3>{action.title}</h3></div><button onClick={onClose}><X/></button></div>
      <div className="voice-state"><span className={listening?'dot live':speaking?'dot speaking':'dot'}></span>{listening?'أسمعك الآن...':speaking?'قاعد أرد عليك...':continuousVoice?'المحادثة الصوتية جاهزة':'جاهز'}</div>
      <div className="chat-messages">
        {!messages.length&&<div className="chat-empty">تكلم معي طبيعي. بعد ما تخلص كلامك راح أرد عليك وأكمل معك نفس سياق المحادثة.</div>}
        {messages.map((m,i)=><div key={i} className={`bubble ${m.role}`}>{m.text}</div>)}
        {loading&&<div className="bubble assistant typing">قاعد أفكر...</div>}
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
    <div className="backdrop-photo"/><div className="page-overlay"/>{settings.rain&&<div className="rain-layer"/>}
    <main className="mobile-shell">
      <header className="top-search"><div className="search-box"><Search size={24}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث في مشاريعك وملاحظاتك..."/></div><button className="settings-btn" onClick={()=>setSettingsOpen(true)}><Settings size={24}/></button></header>
      {normalized&&<div className="search-results">{matches.length?matches.map(item=><button key={item.id} onClick={()=>item.id==='mueen'||item.id==='qadha'?openProject(item.id):setActiveAction(actions.find(a=>a.id===item.id))}><b>{item.title}</b><span>{item.sub}</span></button>):<div>ما لقيت نتيجة مطابقة</div>}</div>}
      <section className="hero-card"><div className="hero-bg"/><div className="hero-shade"/><div className="change-pill">مساعدك الشخصي</div><div className="hero-copy"><div className="greeting">{greeting}</div><h1>كيف أقدر أساعدك اليوم؟</h1><p>تكلم معي أو افتح أحد مشاريعك</p></div><button className="mascot-placeholder mascot-idle" onClick={()=>setActiveAction({id:'voice',emoji:'🎙️',title:'محادثة صوتية',sub:'',prompt:''})}><div className="reaction">🎙️</div><div className="boy-head"><span/></div><div className="boy-body"><i/></div></button></section>
      <section className="action-grid">{actions.map(a=><button key={a.id} className="action-card" onClick={()=>setActiveAction(a)}><span className="action-emoji">{a.emoji}</span><strong>{a.title}</strong><span className="action-sub">{a.sub}</span></button>)}</section>
      <section className="projects-section"><h2>مشاريعي</h2><div className="projects-grid">
        <article className="project-card clickable-project" onClick={()=>openProject('mueen')}><div className="project-logo green">م</div><div className="project-info"><strong>مُعين</strong><span>لوحة تحكم المشروع</span></div><button>فتح</button></article>
        <article className="project-card clickable-project" onClick={()=>openProject('qadha')}><div className="project-logo purple">ق</div><div className="project-info"><strong>قدّها</strong><span>لوحة تحكم + فتح الموقع</span></div><button>فتح</button></article>
      </div></section>
      <section className="help-card"><div><h3>محادثة مباشرة</h3><p>اضغط وابدأ تتكلم، وأنا أكمل معك صوتيًا.</p></div><button onClick={()=>setActiveAction({id:'ask',emoji:'🎙️',title:'محادثة مع Nawaf AI',sub:'',prompt:''})}><ChevronLeft/></button></section>
    </main>
    {settingsOpen&&<SettingsModal settings={settings} setSettings={setSettings} onClose={()=>setSettingsOpen(false)}/>} 
    {activeAction&&<ConversationSheet action={activeAction} apiKey={settings.geminiApiKey} voiceReplies={settings.voiceReplies} continuousVoice={settings.continuousVoice} onClose={()=>setActiveAction(null)}/>} 
    {project&&<ProjectDashboard project={project} onClose={()=>setProject(null)}/>} 
  </div>;
}
