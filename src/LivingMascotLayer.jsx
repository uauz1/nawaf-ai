import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const BEHAVIORS = [
  { id:'gaming', title:'يلعب بلايستيشن', image:'/character/mode-1.webp', prop:'🎮', mood:'مركز', min:18000, max:36000, pos:['stage-center','stage-right'] },
  { id:'snack', title:'ياكل سناك', image:'/character/mode-2.webp', prop:'🍟', mood:'رايق', min:15000, max:30000, pos:['stage-left','stage-center'] },
  { id:'watching', title:'يتفرج', image:'/character/mode-3.webp', prop:'📺', mood:'مندمج', min:20000, max:42000, pos:['stage-right','stage-center'] },
  { id:'celebrate', title:'يحتفل', image:'/character/mode-4.webp', prop:'✨', mood:'متحمس', min:9000, max:18000, pos:['stage-center'] },
  { id:'sleep', title:'غافي شوي', image:'/character/mode-3.webp', prop:'😴', mood:'نعسان', min:24000, max:50000, pos:['stage-left'] },
  { id:'football', title:'يلعب كورة', image:'/character/mode-4.webp', prop:'⚽', mood:'نشيط', min:12000, max:26000, pos:['stage-right','stage-center'] },
  { id:'drink', title:'يشرب شيء', image:'/character/mode-2.webp', prop:'🥤', mood:'بريك', min:14000, max:28000, pos:['stage-left','stage-center'] },
  { id:'music', title:'يسمع شيء', image:'/character/mode-4.webp', prop:'🎧', mood:'مروق', min:16000, max:30000, pos:['stage-center','stage-right'] },
  { id:'thinking', title:'يفكر', image:'/character/mode-1.webp', prop:'💡', mood:'سرحان', min:13000, max:28000, pos:['stage-left','stage-right'] },
  { id:'lazy', title:'منسدح', image:'/character/mode-3.webp', prop:'🛋️', mood:'كسلان', min:22000, max:45000, pos:['stage-left','stage-center'] },
];

const REACTIONS = ['👋','😂','🤨','😎','✨','🙌','😴','💡','🎮','🍿'];

const random = (arr) => arr[Math.floor(Math.random() * arr.length)];
const waitFor = (b) => Math.floor(b.min + Math.random() * (b.max - b.min));

function chooseNext(current, history) {
  const recent = new Set(history.slice(-3));
  const pool = BEHAVIORS.filter((b) => b.id !== current?.id && !recent.has(b.id));
  return random(pool.length ? pool : BEHAVIORS.filter((b) => b.id !== current?.id));
}

export default function LivingMascotLayer() {
  const [host, setHost] = useState(null);
  const [behavior, setBehavior] = useState(() => random(BEHAVIORS));
  const [position, setPosition] = useState('stage-center');
  const [reaction, setReaction] = useState('');
  const [history, setHistory] = useState([]);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const findHost = () => setHost(document.querySelector('.living-header'));
    findHost();
    const id = window.setInterval(findHost, 1200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setPosition(random(behavior.pos));
    clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      const next = chooseNext(behavior, history);
      setHistory((h) => [...h.slice(-5), behavior.id]);
      setBehavior(next);
    }, waitFor(behavior));
    return () => clearTimeout(timeoutRef.current);
  }, [behavior]);

  const caption = useMemo(() => `${behavior.title} · ${behavior.mood}`, [behavior]);

  const interact = () => {
    setReaction(random(REACTIONS));
    window.setTimeout(() => setReaction(''), 1400);
    if (Math.random() > .62) {
      setHistory((h) => [...h.slice(-5), behavior.id]);
      setBehavior(chooseNext(behavior, history));
    }
  };

  if (!host) return null;

  return createPortal(
    <div className="mascot-v2" aria-label="شخصية Nawaf AI الحية">
      <button className={`mascot-v2-stage ${position} behavior-${behavior.id}`} onClick={interact} aria-label={caption} title={caption}>
        <span className="mascot-v2-prop">{behavior.prop}</span>
        <img src={behavior.image} alt={behavior.title} />
        {reaction && <span className="mascot-v2-reaction">{reaction}</span>}
        <span className="mascot-v2-status"><b>{behavior.title}</b><small>{behavior.mood}</small></span>
      </button>
    </div>,
    host
  );
}
