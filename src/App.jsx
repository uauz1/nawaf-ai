import React, { useMemo, useState } from 'react';
import { Bell, ChevronDown, Code2, Crown, FileText, Gamepad2, Gift, Home, Image, Lightbulb, Menu, MessageCircle, Mic, Moon, Paperclip, Search, Send, Settings, Sparkles, Sun, Wrench, X } from 'lucide-react';

const cards = [
  { icon: Gamepad2, title: 'تطوير الألعاب', sub: 'ساعدني في مشروع قدّها' },
  { icon: Code2, title: 'حل مشكلة تقنية', sub: 'عندي خطأ في الكود' },
  { icon: FileText, title: 'كتابة محتوى', sub: 'اكتب لي برومبت' },
  { icon: Lightbulb, title: 'أفكار ومخططات', sub: 'عطني اقتراحات جديدة' },
];

function Sidebar({open,onClose}){
  return <aside className={`sidebar ${open?'open':''}`}>
    <div className="brand"><div className="brand-n">N</div><div><b>Nawaf AI</b><span>مساعدك الشخصي</span></div></div>
    <button className="new-chat"><span className="plus">＋</span><b>محادثة جديدة</b><kbd>Ctrl + K</kbd></button>
    <nav>
      <button className="active"><Home/>الرئيسية</button>
      <button><MessageCircle/>المحادثات السابقة</button>
      <button><FileText/>المشاريع</button>
      <button><FileText/>الملاحظات</button>
      <button><Wrench/>الأدوات</button>
      <button><Settings/>الإعدادات</button>
    </nav>
    <div className="api-card">
      <div><Crown/><b>Gemini API</b></div>
      <small><i/> متصل · مجاني</small>
      <div className="progress"><span/></div>
      <div className="usage"><span>الاستخدام الشهري</span><b>12%</b></div>
    </div>
    <button className="close-side" onClick={onClose}><X/></button>
  </aside>
}

function RightPanel(){
  return <aside className="right-panel">
    <section><h3>النموذج الحالي</h3><div className="model-box"><Sparkles/><div><b>Gemini (تلقائي)</b><small><i/> متصل وجاهز</small></div><ChevronDown/></div><div className="mini-grid"><div><Sun/><b>سريع</b><small>استجابة فورية</small></div><div><Gift/><b>مجاني</b><small>Free Tier</small></div></div></section>
    <section><h3>أدوات سريعة</h3><div className="tools-grid"><button><FileText/>تلخيص نص</button><button><Sparkles/>ترجمة</button><button><Code2/>تصحيح كود</button><button><Image/>تحليل صورة</button></div></section>
    <section className="daily"><h3><Lightbulb/> معلومة اليوم</h3><div><b>“الاستمرارية تصنع الفرق.”</b><small>خطوة صغيرة كل يوم، تقربك من هدفك.</small></div></section>
  </aside>
}

export default function App(){
  const [menu,setMenu]=useState(false); const [text,setText]=useState('');
  const greeting=useMemo(()=>new Date().getHours()<12?'صباح الخير يا نواف':'مساء الخير يا نواف',[]);
  return <div className="shell">
    <Sidebar open={menu} onClose={()=>setMenu(false)}/>
    {menu&&<button className="backdrop" onClick={()=>setMenu(false)}/>}
    <div className="workspace">
      <header className="topbar">
        <button className="menu-btn" onClick={()=>setMenu(true)}><Menu/></button>
        <div className="search"><Search/><input placeholder="ابحث في محادثاتك..."/><kbd>Ctrl + /</kbd></div>
        <div className="top-actions"><button><Sun/></button><button className="bell"><Bell/><i/></button><div className="avatar">ن</div><div className="profile"><b>نواف</b><span>مستخدم</span></div><ChevronDown/></div>
      </header>
      <div className="body-grid">
        <main className="center">
          <section className="welcome"><h1>👋 {greeting}</h1><h2>وش تبغى أساعدك فيه اليوم؟</h2><p>محادثة • تخطيط • برمجة • أفكار • كل شيء في مكان واحد</p></section>
          <div className="cards">{cards.map(({icon:Icon,title,sub})=><button key={title}><div className="card-icon"><Icon/></div><b>{title}</b><small>{sub}</small><span>←</span></button>)}</div>
          <section className="conversation"><div className="assistant-row"><div className="mini-n">N</div><div className="bubble"><b>هلا نواف! 👋</b><p>أنا مساعدك الذكي، جاهز أساعدك في أي شيء.<br/>تفضل اكتب سؤالك أو طلبك، أو اختر من الاقتراحات أعلاه.</p></div></div><time>7:12 ص</time></section>
          <section className="composer-wrap"><div className="composer"><button><Paperclip/></button><input value={text} onChange={e=>setText(e.target.value)} placeholder="اكتب رسالتك هنا..."/><button><Mic/></button><button className="send"><Send/></button></div><div className="chips"><button>🌐 بحث عبر الإنترنت</button><button>💡 تفكير أعمق</button><button className="model-chip">Gemini (تلقائي) <ChevronDown/></button></div></section>
        </main>
        <RightPanel/>
      </div>
    </div>
  </div>
}
