const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;

function getSuggestions(text) {
  const value = String(text || '').trim();
  if (!value) return [];

  if (/(https?:\/\/|رابط|الموقع|GitHub|جيت.?هب)/i.test(value)) {
    return [
      { icon: '↗', label: 'افتح الرابط', prompt: 'افتح الرابط المذكور الآن.' },
      { icon: '✓', label: 'كمل', prompt: 'كمل من هنا.' }
    ];
  }

  if (/(خطة|خطوات|مرحلة|تنفيذ|ننفذ|نبدأ)/i.test(value)) {
    return [
      { icon: '⚡', label: 'نفّذ', prompt: 'يلا نفذ الخطوة التالية مباشرة.' },
      { icon: '≡', label: 'اختصر', prompt: 'اختصرها لي بأقصر شكل ممكن.' },
      { icon: '›', label: 'كمل', prompt: 'كمل.' }
    ];
  }

  if (/[؟?]\s*$/.test(value) || /(تبغى|تبي|أبدأ|أكمل|موافق|مناسب لك)/i.test(value)) {
    return [
      { icon: '✓', label: 'نعم، كمل', prompt: 'نعم، كمل.' },
      { icon: '⚡', label: 'يلا نفّذ', prompt: 'يلا نفذ.' },
      { icon: '✕', label: 'لا، غيّره', prompt: 'لا، غيره.' }
    ];
  }

  if (value.length > 180) {
    return [
      { icon: '≡', label: 'اختصر', prompt: 'اختصر آخر رد في نقاط قصيرة جدًا.' },
      { icon: '›', label: 'كمل', prompt: 'كمل.' }
    ];
  }

  return [];
}

function sendPrompt(prompt) {
  const textarea = document.querySelector('.composer textarea');
  if (!textarea) return;

  textarea.focus();
  if (nativeValueSetter) nativeValueSetter.call(textarea, prompt);
  else textarea.value = prompt;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));

  requestAnimationFrame(() => {
    setTimeout(() => {
      const send = document.querySelector('.composer .send-btn');
      if (send && !send.disabled) send.click();
    }, 30);
  });
}

function renderOptions() {
  const messages = document.querySelector('.messages');
  if (!messages) return;

  const previous = messages.querySelector('.smart-options');
  previous?.remove();

  const assistantMessages = messages.querySelectorAll('.message.assistant');
  const latest = assistantMessages[assistantMessages.length - 1];
  if (!latest || latest.querySelector('.typing')) return;

  const text = latest.textContent || '';
  const suggestions = getSuggestions(text);
  if (!suggestions.length) return;

  const wrap = document.createElement('div');
  wrap.className = 'smart-options';
  wrap.setAttribute('aria-label', 'خيارات سريعة');

  suggestions.forEach(item => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'smart-option';
    button.innerHTML = `<span aria-hidden="true">${item.icon}</span><b>${item.label}</b>`;
    button.addEventListener('click', () => sendPrompt(item.prompt));
    wrap.appendChild(button);
  });

  messages.appendChild(wrap);
}

let frame = 0;
const observer = new MutationObserver(() => {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(renderOptions);
});

function boot() {
  const root = document.getElementById('root');
  if (!root) return;
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  renderOptions();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
