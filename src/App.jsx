import React, { useEffect, useMemo, useState } from 'react';
import { Search, Settings, ChevronLeft } from 'lucide-react';

const actions = [
  { emoji: '💡', title: 'أفكار جديدة', sub: 'اقتراحات تناسبك' },
  { emoji: '⚡', title: 'حل مشكلة', sub: 'تحليل سريع وواضح' },
  { emoji: '📋', title: 'خطط ومشاريع', sub: 'رتب يومك ومشاريعك' },
  { emoji: '⌨️', title: 'مساعدة برمجية', sub: 'كود وحلول تقنية' },
];

const mascotModes = [
  { id: 'idle', emoji: '😅' },
  { id: 'wave', emoji: '👋' },
  { id: 'think', emoji: '🤔' },
  { id: 'happy', emoji: '😄' },
  { id: 'sleepy', emoji: '😴' },
];

function pickNext(currentId) {
  const pool = mascotModes.filter((m) => m.id !== currentId);
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function App() {
  const [mascotMode, setMascotMode] = useState(mascotModes[0]);
  const [reaction, setReaction] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      setMascotMode((current) => pickNext(current.id));
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  const interactMascot = () => {
    const reactions = ['👋', '😂', '✨', '🤨', '😎', '💡'];
    setReaction(reactions[Math.floor(Math.random() * reactions.length)]);
    setMascotMode((current) => pickNext(current.id));
    window.setTimeout(() => setReaction(''), 1300);
  };

  const greeting = useMemo(() => new Date().getHours() < 12 ? 'صباح الخير يا نواف ☀️' : 'مساء الخير يا نواف 🌙', []);

  return (
    <div className="page" dir="rtl">
      <div className="backdrop-photo" />
      <div className="page-overlay" />
      <div className="rain-layer" />

      <main className="mobile-shell">
        <header className="top-search">
          <div className="search-box">
            <Search size={24} />
            <input placeholder="ابحث في مشاريعك وملاحظاتك..." />
          </div>
          <button className="settings-btn" aria-label="الإعدادات"><Settings size={24}/></button>
        </header>

        <section className="hero-card">
          <div className="hero-bg" />
          <div className="hero-shade" />
          <div className="change-pill">يتغير كل 8 ثواني</div>
          <div className="hero-copy">
            <div className="greeting">{greeting}</div>
            <h1>كيف أقدر أساعدك اليوم؟</h1>
            <p>الأحد، ٢٤ ربيع الأول، ١٤٤٨ هـ</p>
          </div>

          <button className={`mascot-placeholder mascot-${mascotMode.id}`} onClick={interactMascot} aria-label="التفاعل مع الشخصية">
            <div className="reaction">{reaction || mascotMode.emoji}</div>
            <div className="boy-head"><span/></div>
            <div className="boy-body"><i/></div>
          </button>
        </section>

        <section className="action-grid">
          {actions.map(({emoji,title,sub}) => (
            <button key={title} className="action-card">
              <span className="action-emoji">{emoji}</span>
              <strong>{title}</strong>
              <span className="action-sub">{sub}</span>
            </button>
          ))}
        </section>

        <section className="projects-section">
          <h2>مشاريعي</h2>
          <div className="projects-grid">
            <article className="project-card">
              <div className="project-logo green">م</div>
              <div className="project-info"><strong>مُعين</strong><span>تطبيق<br/>إسلامي<br/>شامل</span></div>
              <button>راجع<br/>المشروع</button>
            </article>
            <article className="project-card">
              <div className="project-logo purple">ق</div>
              <div className="project-info"><strong>قدّها</strong><span>منصة<br/>ألعاب<br/>جماعية</span></div>
              <button>راجع<br/>المشروع</button>
            </article>
          </div>
        </section>

        <section className="help-card">
          <div>
            <h3>كيف أقدر أساعدك الآن؟</h3>
            <p>اكتب اللي في بالك وأنا أرتبه معك خطوة بخطوة.</p>
          </div>
          <button><ChevronLeft/></button>
        </section>
      </main>
    </div>
  );
}
