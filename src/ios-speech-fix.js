// Robust iOS/Safari speechSynthesis patch for Nawaf AI.
// Fixes the common WebKit issue where speech starts with one word then stalls,
// or refuses to start after microphone recognition / async network requests.

const isIOSWebKit = (() => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const webkit = /AppleWebKit/i.test(ua);
  return iOS && webkit;
})();

if (isIOSWebKit && typeof window !== 'undefined' && window.speechSynthesis && window.SpeechSynthesisUtterance) {
  // One-time migration: force the fast/reliable voice defaults on iPhone.
  try {
    const key = 'nawaf-ai-settings';
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    localStorage.setItem(key, JSON.stringify({
      ...saved,
      voiceReplies: true,
      continuousVoice: true,
      voiceMode: 'instant'
    }));
  } catch (_) {}

  const synth = window.speechSynthesis;
  const proto = Object.getPrototypeOf(synth);
  const nativeSpeak = synth.speak.bind(synth);
  const nativeCancel = synth.cancel.bind(synth);
  const nativeResume = synth.resume.bind(synth);
  const nativePause = synth.pause.bind(synth);

  let runId = 0;
  let activeUtterances = [];
  let keepAliveTimer = null;
  let unlocked = false;

  const clearKeepAlive = () => {
    if (keepAliveTimer) clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  };

  const hardReset = () => {
    runId += 1;
    clearKeepAlive();
    activeUtterances = [];
    try { nativeCancel(); } catch (_) {}
  };

  const splitText = text => {
    const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
    if (!cleaned) return [];

    // Short chunks are much more reliable on iOS than one long utterance.
    const sentencePieces = cleaned.split(/(?<=[.!?؟،؛:])\s+/u).filter(Boolean);
    const chunks = [];
    for (const piece of sentencePieces) {
      const words = piece.split(/\s+/).filter(Boolean);
      if (words.length <= 9) {
        chunks.push(piece);
        continue;
      }
      for (let i = 0; i < words.length; i += 8) chunks.push(words.slice(i, i + 8).join(' '));
    }
    return chunks.length ? chunks : [cleaned];
  };

  const copyVoiceProps = (from, to) => {
    try { to.lang = from.lang || 'ar-SA'; } catch (_) {}
    try { to.rate = Number.isFinite(from.rate) ? from.rate : 1; } catch (_) {}
    try { to.pitch = Number.isFinite(from.pitch) ? from.pitch : 1; } catch (_) {}
    try { to.volume = Number.isFinite(from.volume) ? from.volume : 1; } catch (_) {}
    try { if (from.voice) to.voice = from.voice; } catch (_) {}
  };

  const keepAlive = id => {
    clearKeepAlive();
    keepAliveTimer = setInterval(() => {
      if (id !== runId) return clearKeepAlive();
      try { nativeResume(); } catch (_) {}
    }, 400);
  };

  const robustSpeak = original => {
    if (!original || !String(original.text || '').trim()) {
      try { nativeSpeak(original); } catch (_) {}
      return;
    }

    hardReset();
    const id = runId;
    const chunks = splitText(original.text);
    let index = 0;
    let started = false;
    let finished = false;

    const finish = event => {
      if (finished || id !== runId) return;
      finished = true;
      clearKeepAlive();
      activeUtterances = [];
      try { original.onend?.(event); } catch (_) {}
    };

    const fail = event => {
      if (finished || id !== runId) return;
      const code = event?.error || '';
      // Safari frequently throws these between chunks; continue instead of going silent.
      if (/interrupted|canceled|cancelled|audio-busy/i.test(code) && index < chunks.length) {
        setTimeout(speakNext, 45);
        return;
      }
      finished = true;
      clearKeepAlive();
      activeUtterances = [];
      try { original.onerror?.(event); } catch (_) {}
    };

    const speakNext = () => {
      if (id !== runId || finished) return;
      if (index >= chunks.length) return finish();

      const u = new SpeechSynthesisUtterance(chunks[index++]);
      copyVoiceProps(original, u);
      activeUtterances.push(u); // Prevent iOS garbage-collection from killing speech mid-sentence.

      u.onstart = event => {
        if (!started) {
          started = true;
          try { original.onstart?.(event); } catch (_) {}
        }
        try { nativeResume(); } catch (_) {}
      };

      u.onend = () => {
        if (id !== runId || finished) return;
        setTimeout(speakNext, 40);
      };

      u.onerror = fail;

      try {
        nativeSpeak(u);
        keepAlive(id);
        // Safari may stay paused immediately after SpeechRecognition releases the mic.
        setTimeout(() => {
          if (id !== runId || finished) return;
          try { nativeResume(); } catch (_) {}
        }, 70);
        setTimeout(() => {
          if (id !== runId || finished) return;
          try { nativeResume(); } catch (_) {}
        }, 180);
      } catch (error) {
        fail({ error: error?.message || 'speak-failed' });
      }
    };

    // Tiny audio-session handoff delay from microphone to speaker on iPhone.
    setTimeout(speakNext, 85);
  };

  const robustCancel = () => {
    runId += 1;
    clearKeepAlive();
    activeUtterances = [];
    try { nativeCancel(); } catch (_) {}
  };

  // Patch both the instance and prototype (some iOS versions ignore instance replacement).
  try { synth.speak = robustSpeak; } catch (_) {}
  try { if (proto) proto.speak = function(utterance) { return robustSpeak(utterance); }; } catch (_) {}
  try { synth.cancel = robustCancel; } catch (_) {}
  try { if (proto) proto.cancel = function() { return robustCancel(); }; } catch (_) {}
  try { synth.pause = nativePause; } catch (_) {}
  try { synth.resume = nativeResume; } catch (_) {}

  // Unlock speech synthesis during a real user gesture so later async replies can speak.
  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    try {
      const u = new SpeechSynthesisUtterance('.');
      u.volume = 0;
      u.rate = 2;
      u.lang = 'ar-SA';
      activeUtterances.push(u);
      nativeSpeak(u);
      setTimeout(() => {
        try { nativeCancel(); } catch (_) {}
        activeUtterances = [];
      }, 100);
    } catch (_) {}
  };

  ['pointerdown', 'touchstart', 'click'].forEach(type => {
    window.addEventListener(type, unlock, { capture: true, passive: true });
  });
}
