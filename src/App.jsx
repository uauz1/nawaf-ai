import React from 'react';
import { Search, Settings, Lightbulb, Zap, ClipboardList, Keyboard, ChevronLeft } from 'lucide-react';

const actions = [
  { icon: Lightbulb, title: 'أفكار جديدة', sub: 'اقتراحات تناسبك' },
  { icon: Zap, title: 'حل مشكلة', sub: 'تحليل سريع وواضح' },
  { icon: ClipboardList, title: 'خطط ومشاريع', sub: 'رتب يومك ومشاريعك' },
  { icon: Keyboard, title: 'مساعدة برمجية', sub: 'كود وحلول تقنية' },
];

export default function App() {
  return (
    <div className="page" dir="rtl">
      <div className="backdrop-photo" />
      <div className="page-overlay" />

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
            <div className="greeting">مساء الخير يا نواف 🌙</div>
            <h1>كيف أقدر أساعدك اليوم؟</h1>
            <p>الأحد، ٢٤ ربيع الأول، ١٤٤٨ هـ</p>
          </div>
          <div className="mascot-placeholder">
            <div className="reaction">😅</div>
            <div className="boy-head"><span/></div>
            <div className="boy-body"><i/></div>
          </div>
        </section>

        <section className="action-grid">
          {actions.map(({icon:Icon,title,sub}) => (
            <button key={title} className="action-card">
              <Icon size={28}/>
              <strong>{title}</strong>
              <span>{sub}</span>
            </button>
          ))}
        </section>

        <section className="projects-section">
          <h2>مشاريعي</h2>
          <div className="projects-grid">
            <article className="project-card">
              <div className="project-logo green">م</div>
              <div className="project-info"><strong>مُعين</strong><span>تطبيق إسلامي شامل</span></div>
              <button>راجع<br/>المشروع</button>
            </article>
            <article className="project-card">
              <div className="project-logo purple">ق</div>
              <div className="project-info"><strong>قدّها</strong><span>منصة ألعاب جماعية</span></div>
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
