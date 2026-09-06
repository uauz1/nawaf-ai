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
  const synth = window.speechSynthesis;
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
      try {
        if (synth.paused) nativeResume();
        else nativeResume();
      } catch (_) {}
    }, 450);
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
      // WebKit often emits transient interrupted/canceled errors. Continue when possible.
      const code = event?.error || '';
      if (/interrupted|canceled|cancelled/i.test(code) && index < chunks.length) {
        setTimeout(speakNext, 30);
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
      activeUtterances.push(u); // Keep strong references; iOS may stop if GC collects utterance.

      u.onstart = event => {
        if (!started) {
          started = true;
          try { original.onstart?.(event); } catch (_) {}
        }
        try { nativeResume(); } catch (_) {}
      };

      u.onend = event => {
        if (id !== runId || finished) return;
        // Give WebKit a tiny audio-session handoff gap between chunks.
        setTimeout(speakNext, 35);
      };

      u.onerror = fail;

      try {
        nativeSpeak(u);
        keepAlive(id);
        // Safari occasionally queues but stays paused after speech recognition.
        setTimeout(() => {
          if (id !== runId || finished) return;
          try { nativeResume(); } catch (_) {}
        }, 80);
      } catch (error) {
        fail({ error: error?.message || 'speak-failed' });
      }
    };

    // Slight handoff delay from microphone capture to speaker output on iPhone.
    setTimeout(speakNext, 70);
  };

  // Patch methods used by the app.
  try { synth.speak = robustSpeak; } catch (_) {}
  try {
    synth.cancel = () => {
      runId += 1;
      clearKeepAlive();
      activeUtterances = [];
      try { nativeCancel(); } catch (_) {}
    };
  } catch (_) {}
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
      }, 90);
    } catch (_) {}
  };

  ['pointerdown', 'touchstart', 'click'].forEach(type => {
    window.addEventListener(type, unlock, { capture: true, passive: true, once: false });
  });
}
