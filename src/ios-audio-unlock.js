// iOS/WebKit audio unlock for async TTS playback.
// Safari may block Audio.play() when audio is created after an awaited network request.
// We unlock one shared AudioContext on the user's first tap and use it for data-URI audio.

const isIOSWebKit = (() => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return iOS;
})();

if (isIOSWebKit && typeof window !== 'undefined') {
  const OriginalAudio = window.Audio;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;

  if (AudioCtx) {
    const ctx = new AudioCtx();

    const unlock = async () => {
      try {
        if (ctx.state !== 'running') await ctx.resume();
        // Play a near-silent one-sample buffer while still inside the user gesture.
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        gain.gain.value = 0.00001;
        source.buffer = buffer;
        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(0);
      } catch (_) {}
    };

    ['pointerdown', 'touchstart', 'click'].forEach(type => {
      window.addEventListener(type, unlock, { capture: true, passive: true });
    });

    const dataUriToArrayBuffer = uri => {
      const comma = String(uri || '').indexOf(',');
      if (comma < 0) throw new Error('Invalid audio data URI');
      const base64 = uri.slice(comma + 1);
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes.buffer;
    };

    class IOSDataAudio {
      constructor(src = '') {
        this._src = src;
        this._source = null;
        this.onended = null;
        this.onerror = null;
      }

      get src() { return this._src; }
      set src(value) { this._src = value || ''; }

      async play() {
        try {
          if (ctx.state !== 'running') await ctx.resume();
          const arrayBuffer = dataUriToArrayBuffer(this._src);
          const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
          const source = ctx.createBufferSource();
          source.buffer = decoded;
          source.connect(ctx.destination);
          source.onended = () => {
            if (this._source === source) this._source = null;
            this.onended?.();
          };
          this._source = source;
          source.start(0);
        } catch (error) {
          this.onerror?.(error);
          throw error;
        }
      }

      pause() {
        try { this._source?.stop?.(); } catch (_) {}
        this._source = null;
      }
    }

    function PatchedAudio(src) {
      if (typeof src === 'string' && src.startsWith('data:audio/')) {
        return new IOSDataAudio(src);
      }
      return new OriginalAudio(src);
    }

    PatchedAudio.prototype = OriginalAudio.prototype;
    Object.setPrototypeOf(PatchedAudio, OriginalAudio);
    window.Audio = PatchedAudio;
  }
}
