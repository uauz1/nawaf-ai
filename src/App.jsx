import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Bot,
  ChevronLeft,
  Code2,
  FileText,
  Gamepad2,
  Home,
  Lightbulb,
  Menu,
  MessageCircle,
  Mic,
  Moon,
  Paperclip,
  Search,
  Send,
  Settings,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';

const MODES = [
  {
    id: 'gaming',
    title: 'يلعب بلايستيشن',
    emoji: '🎮',
    image: '/character/mode-1.webp',
    status: 'مركز في القيم... بس يسمعك 👀',
    min: 18000,
    max: 36000,
  },
  {
    id: 'snack',
    title: 'ياخذ بريك',
    emoji: '🍟',
    image: '/character/mode-2.webp',
    status: 'بريك خفيف قبل الفكرة الجاية',
    min: 15000,
    max: 32000,
  },
  {
    id: 'watching',
    title: 'يتفرج',
    emoji: '📺',
    image: '/character/mode-3.webp',
    status: 'مندس في الزاوية ويتابع شيء',
    min: 20000,
    max: 40000,
  },
  {
    id: 'celebrating',
    title: 'متحمس',
    emoji: '✨',
    image: '/character/mode-4.webp',
    status: 'شكله فاز بشيء 😄',
    min: 12000,
    max: 28000,
  },
];

const REACTIONS = ['👋', '😄', '🤨', '✨', '🎮', '☕', '😴', '💡'];

const suggestions = [
  { icon: Lightbulb, title: 'أفكار جديدة', sub: 'خلّنا نطلع بشيء مختلف' },
  { icon: Code2, title: 'مساعدة برمجية', sub: 'نبني أو نعدّل مشروعك' },
  { icon: FileText, title: 'خطط ومشاريع', sub: 'رتّب فكرتك من البداية' },
  { icon: Sparkles, title: 'حل مشكلة', sub: 'نفككها ونحلها بسرعة' },
];

function pickDifferent(current) {
  const rest = MODES.filter((m) => m.id !== current.id);
  return rest[Math.floor(Math.random() * rest.length)];
}

function useLivingCharacter() {
  const [mode, setMode] = useState(() => MODES[Math.floor(Math.random() * MODES.length)]);
  const [reaction, setReaction] = useState('');
  const timeoutRef = useRef(null);

  useEffect(() => {
    function schedule(current) {
      clearTimeout(timeoutRef.current);
      const wait = Math.floor(current.min + Math.random() * (current.max - current.min));
      timeoutRef.current = setTimeout(() => {
        const next = pickDifferent(current);
        setMode(next);
        schedule(next);
      }, wait);
    }
    schedule(mode);
    return () => clearTimeout(timeoutRef.current);
  }, []);

  function interact() {
    const nextReaction = REACTIONS[Math.floor(Math.random() * REACTIONS.length)];
    setReaction(nextReaction);
    window.setTimeout(() => setReaction(''), 1500);

    if (Math.random() > 0.55) {
      const next = pickDifferent(mode);
      setMode(next);
    }
  }

  return { mode, reaction, interact, setMode };
}

function LivingHeader() {
  const { mode, reaction, interact, setMode } = useLivingCharacter();
  const [sceneKey, setSceneKey] = useState(0);

  useEffect(() => setSceneKey((v) => v + 1), [mode.id]);

  return (
    <section className="living-header" aria-label="مساحة شخصية Nawaf AI">
      <div className="living-copy">
        <div className="morning-pill"><Sun size={15} /> صباح الخير يا نواف</div>
        <h1>وش تبغى نسوي اليوم؟</h1>
        <p>مساعدك حاضر، والشخصية لها حياتها داخل الصفحة.</p>
        <div className="activity-pill"><span>{mode.emoji}</span><b>{mode.title}</b><small>{mode.status}</small></div>
      </div>

      <button className="character-stage" onClick={interact} title="اضغط على الشخصية" aria-label="تفاعل مع الشخصية">
        <div className="scene-glow" />
        <img key={sceneKey} className={`character-image scene-${mode.id}`} src={mode.image} alt={`شخصية Nawaf AI - ${mode.title}`} />
        {reaction && <span className="reaction-pop">{reaction}</span>}
        <span className="tap-hint">اضغط علي</span>
      </button>

      <div className="mode-dots" aria-label="تغيير وضع الشخصية">
        {MODES.map((item) => (
          <button
            key={item.id}
            className={item.id === mode.id ? 'active' : ''}
            onClick={() => setMode(item)}
            aria-label={item.title}
            title={item.title}
          >
            {item.emoji}
          </button>
        ))}
      </div>
    </section>
  );
}

function Sidebar({ open, onClose }) {
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark">N</div><div><strong>Nawaf AI</strong><small>مساعدك الشخصي</small></div></div>
      <button className="new-chat"><MessageCircle size={18} /> محادثة جديدة <span>+</span></button>
      <nav>
        <button className="active"><Home size={18} /> الرئيسية</button>
        <button><MessageCircle size={18} /> المحادثات السابقة</button>
        <button><FileText size={18} /> المشاريع</button>
        <button><Sparkles size={18} /> الملاحظات</button>
        <button><Settings size={18} /> الإعدادات</button>
      </nav>
      <div className="sidebar-bottom">
        <div className="model-card"><Bot size={18} /><div><span>النموذج الحالي</span><strong>Auto</strong></div><i /></div>
        <div className="usage"><div><span>الاستخدام الشهري</span><b>12%</b></div><div className="bar"><span /></div></div>
        <button><Moon size={17} /> الوضع الليلي <span className="switch on" /></button>
        <button><span>ع</span> اللغة <small>العربية</small></button>
      </div>
      <button className="close-sidebar" onClick={onClose}><X /></button>
    </aside>
  );
}

function ChatPanel() {
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState([]);

  const send = () => {
    const value = message.trim();
    if (!value) return;
    setSent((items) => [...items, value]);
    setMessage('');
  };

  return (
    <section className="chat-panel">
      <div className="chat-title"><div className="bot-dot">N</div><div><strong>Nawaf AI</strong><small>متصل وجاهز</small></div></div>
      <div className="messages">
        <div className="assistant-message">
          <div className="bubble-avatar">N</div>
          <div><b>هلا نواف 👋</b><p>أنا حاضر. نقدر نخطط، نبرمج، نراجع أفكارك أو نكمل أي مشروع بدأناه.</p></div>
        </div>
        {sent.map((item, index) => <div className="user-message" key={`${item}-${index}`}>{item}</div>)}
      </div>
      <div className="composer">
        <button><Paperclip size={20} /></button>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="اكتب رسالتك هنا..."
        />
        <button><Mic size={20} /></button>
        <button className="send" onClick={send}><Send size={19} /></button>
      </div>
      <div className="quick-row"><button>بحث في الويب</button><button>تفكير أعمق</button><button>حلل ملف</button><button>اكتب كود</button></div>
    </section>
  );
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const currentGreeting = useMemo(() => new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير', []);

  return (
    <div className="app-shell">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      {menuOpen && <button className="backdrop" onClick={() => setMenuOpen(false)} aria-label="إغلاق القائمة" />}

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMenuOpen(true)}><Menu /></button>
          <div className="search-box"><Search size={18} /><input placeholder="ابحث في محادثاتك..." /></div>
          <div className="top-actions"><button><Bell size={19} /></button><div className="user-chip"><span>ن</span><div><b>نواف</b><small>مستخدم</small></div></div></div>
        </header>

        <div className="content-wrap">
          <LivingHeader />

          <div className="section-head"><div><small>{currentGreeting}</small><h2>اختر بداية سريعة</h2></div><button>عرض الكل <ChevronLeft size={16} /></button></div>
          <div className="suggestion-grid">
            {suggestions.map(({ icon: Icon, title, sub }) => (
              <button className="suggestion-card" key={title}><div className="icon-wrap"><Icon size={20} /></div><div><b>{title}</b><small>{sub}</small></div><ChevronLeft size={18} /></button>
            ))}
          </div>

          <ChatPanel />
        </div>
      </main>
    </div>
  );
}
