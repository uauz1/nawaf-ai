export class NavVoiceSession {
  constructor(callbacks = {}) {
    this.cb = callbacks;
    this.active = false;
    this.processing = false;
    this.recognition = null;
    this.audio = null;
    this.restartTimer = null;
  }

  emitState(state, detail = '') {
    this.cb.onState?.(state, detail);
  }

  get Recognition() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  async start() {
    if (this.active) return;
    if (!this.Recognition) throw new Error('المحادثة الصوتية تحتاج متصفح يدعم التعرف على الكلام مثل Chrome أو Safari حديث.');
    this.active = true;
    this.processing = false;
    this.emitState('connecting', 'أجهز مايك ناڤ…');
    this.listen();
  }

  listen() {
    if (!this.active || this.processing) return;
    clearTimeout(this.restartTimer);
    const Recognition = this.Recognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    this.recognition = recognition;
    recognition.lang = 'ar-SA';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      if (this.active && !this.processing) this.emitState('listening', 'أسمعك الآن…');
    };

    recognition.onresult = event => {
      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const text = event.results[i]?.[0]?.transcript || '';
        if (event.results[i].isFinal) finalText += text;
        else interim += text;
      }
      if (interim.trim()) this.cb.onInputText?.(interim.trim(), false);
      if (finalText.trim()) this.handleTurn(finalText.trim());
    };

    recognition.onerror = event => {
      const code = event?.error || '';
      if (code === 'aborted' || code === 'no-speech') return;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        this.active = false;
        this.emitState('error', 'إذن المايك مرفوض');
        this.cb.onError?.('إذن الميكروفون مرفوض. اسمح للمايك من إعدادات الموقع ثم جرّب مرة ثانية.');
        return;
      }
      this.cb.onError?.(`مشكلة في التقاط الصوت${code ? `: ${code}` : ''}`);
    };

    recognition.onend = () => {
      if (this.recognition === recognition) this.recognition = null;
      if (this.active && !this.processing) {
        this.restartTimer = setTimeout(() => this.listen(), 280);
      }
    };

    try {
      recognition.start();
    } catch (_) {
      if (this.active && !this.processing) this.restartTimer = setTimeout(() => this.listen(), 500);
    }
  }

  async handleTurn(message) {
    if (!this.active || this.processing || !message) return;
    this.processing = true;
    clearTimeout(this.restartTimer);
    try { this.recognition?.abort?.(); } catch (_) {}
    this.recognition = null;
    this.cb.onInputText?.(message, true);
    this.emitState('thinking', 'ناڤ تفكر…');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history: this.cb.getHistory?.() || [] })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'تعذر الحصول على رد');
      const reply = String(data?.text || '').replace(/^\[IMAGE_REQUEST\]\s*/i, '').trim() || 'تم.';
      this.cb.onOutputText?.(reply, true);
      this.emitState('speaking', 'ناڤ تتكلم…');

      const ttsResponse = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: reply })
      });
      const tts = await ttsResponse.json();
      if (!ttsResponse.ok || !tts?.audioBase64) throw new Error(tts?.error || 'تعذر تشغيل صوت ناڤ');
      if (!this.active) return;

      await new Promise((resolve, reject) => {
        const audio = new Audio(`data:${tts.mimeType || 'audio/wav'};base64,${tts.audioBase64}`);
        this.audio = audio;
        audio.onended = () => {
          if (this.audio === audio) this.audio = null;
          resolve();
        };
        audio.onerror = () => {
          if (this.audio === audio) this.audio = null;
          reject(new Error('تعذر تشغيل الصوت على الجهاز'));
        };
        const playPromise = audio.play();
        if (playPromise?.catch) playPromise.catch(reject);
      });
    } catch (error) {
      if (this.active) this.cb.onError?.(error?.message || 'تعذر إكمال المحادثة الصوتية');
    } finally {
      this.processing = false;
      if (this.active) {
        this.emitState('listening', 'أسمعك الآن…');
        this.restartTimer = setTimeout(() => this.listen(), 220);
      }
    }
  }

  async stop() {
    this.active = false;
    this.processing = false;
    clearTimeout(this.restartTimer);
    try { this.recognition?.abort?.(); } catch (_) {}
    this.recognition = null;
    try { this.audio?.pause?.(); } catch (_) {}
    try { if (this.audio) this.audio.src = ''; } catch (_) {}
    this.audio = null;
    this.emitState('idle', 'جاهز');
  }
}
