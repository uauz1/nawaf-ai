const LIVE_MODEL = 'gemini-3.1-flash-live-preview';
const LIVE_WS = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';

function bytesToBase64(bytes){let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+0x8000,bytes.length)));return btoa(binary)}
function base64ToBytes(base64){const binary=atob(base64),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes}
function floatTo16BitPCM(input){const out=new Int16Array(input.length);for(let i=0;i<input.length;i++){const s=Math.max(-1,Math.min(1,input[i]));out[i]=s<0?s*0x8000:s*0x7fff}return new Uint8Array(out.buffer)}
function downsampleBuffer(buffer,inputRate,outputRate=16000){if(outputRate>=inputRate)return buffer;const ratio=inputRate/outputRate,length=Math.max(1,Math.round(buffer.length/ratio)),result=new Float32Array(length);let ri=0,ii=0;while(ri<length){const next=Math.round((ri+1)*ratio);let sum=0,count=0;for(let i=ii;i<next&&i<buffer.length;i++){sum+=buffer[i];count++}result[ri++]=count?sum/count:0;ii=next}return result}
function parseRate(mimeType,fallback=24000){const m=/rate=(\d+)/i.exec(String(mimeType||''));return m?Number(m[1]):fallback}

export class GeminiLiveVoice{
  constructor(callbacks={}){this.cb=callbacks;this.ws=null;this.stream=null;this.audioContext=null;this.source=null;this.processor=null;this.sink=null;this.inputRate=48000;this.nextPlayTime=0;this.playingSources=new Set();this.ready=false;this.closed=false;this.sendMic=true;this.inputText='';this.outputText=''}
  emitState(state,detail=''){this.cb.onState?.(state,detail)}
  async start(){
    if(this.ws||this.stream)return;this.closed=false;this.emitState('connecting','أجهز صوت ناڤ…');
    const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)throw new Error('Web Audio غير مدعوم على هذا الجهاز');
    this.audioContext=new AudioCtx({latencyHint:'interactive'});try{await this.audioContext.resume()}catch(_){}
    const streamPromise=navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1}});
    const tokenPromise=fetch('/api/live-token',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(async r=>{const d=await r.json();if(!r.ok||!d?.token)throw new Error(d?.error||'تعذر إنشاء جلسة Live');return d.token});
    const [stream,token]=await Promise.all([streamPromise,tokenPromise]);if(this.closed){stream.getTracks().forEach(t=>t.stop());return}
    this.stream=stream;this.inputRate=this.audioContext.sampleRate||48000;
    await new Promise((resolve,reject)=>{
      const ws=new WebSocket(`${LIVE_WS}?access_token=${encodeURIComponent(token)}`);this.ws=ws;let settled=false;
      const timer=setTimeout(()=>{if(!settled)reject(new Error('اتصال الصوت المباشر تأخر'))},9000);
      ws.onopen=()=>ws.send(JSON.stringify({setup:{model:`models/${LIVE_MODEL}`,generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:'Aoede'}}},thinkingConfig:{thinkingLevel:'minimal'}},systemInstruction:{parts:[{text:'اسمك ناڤ. أنتِ مساعدة نواف الشخصية بصوت أنثوي شاب وواضح وطبيعي. تكلمي دائمًا بالعربية بلهجة سعودية خفيفة ومفهومة، بسرعة محادثة طبيعية وبجمل قصيرة. لا تستخدمي نبرة آلية ولا فصحى ثقيلة. لا تتكلمين من نفسك قبل ما تسمعين نواف. إذا قاطعك نواف، اوقفي كلامك فورًا واسمعي آخر كلامه ثم ردي عليه مباشرة. بعد كل رد ارجعي للاستماع تلقائيًا بدون ما يحتاج يضغط زر من جديد.'}]},inputAudioTranscription:{},outputAudioTranscription:{},realtimeInputConfig:{automaticActivityDetection:{disabled:false,prefixPaddingMs:120,silenceDurationMs:420}}}}));
      ws.onmessage=event=>{let m;try{m=JSON.parse(event.data)}catch(_){return}
        if(m.setupComplete){clearTimeout(timer);settled=true;this.ready=true;this.sendMic=true;this.emitState('listening','أسمعك الآن…');this.startMicPipeline();resolve();return}
        const c=m.serverContent;if(!c)return;
        if(c.inputTranscription?.text){this.inputText+=c.inputTranscription.text;this.cb.onInputText?.(this.inputText,false)}
        if(c.outputTranscription?.text){this.outputText+=c.outputTranscription.text;this.cb.onOutputText?.(this.outputText,false)}
        for(const part of c.modelTurn?.parts||[]){if(part.inlineData?.data){this.emitState('speaking','ناڤ تتكلم…');this.playPCM(part.inlineData.data,parseRate(part.inlineData.mimeType,24000))}}
        if(c.interrupted){this.stopPlayback();this.sendMic=true;this.emitState('listening','سمعت مقاطعتك…')}
        if(c.turnComplete||c.generationComplete){if(this.inputText.trim())this.cb.onInputText?.(this.inputText.trim(),true);if(this.outputText.trim())this.cb.onOutputText?.(this.outputText.trim(),true);this.inputText='';this.outputText='';const wait=Math.max(0,(this.nextPlayTime-(this.audioContext?.currentTime||0))*1000);setTimeout(()=>{if(this.closed)return;this.sendMic=true;this.emitState('listening','أسمعك الآن…')},Math.min(wait+50,2500))}
      };
      ws.onerror=()=>{clearTimeout(timer);if(!settled)reject(new Error('فشل اتصال Gemini Live'));this.cb.onError?.('انقطع اتصال الصوت المباشر.')};
      ws.onclose=()=>{clearTimeout(timer);this.ready=false;if(!this.closed)this.cb.onError?.('انتهت جلسة الصوت المباشر. اضغط المايك لإعادة الاتصال.');this.emitState('idle','جاهز')};
    })
  }
  startMicPipeline(){if(!this.audioContext||!this.stream||!this.ws)return;this.source=this.audioContext.createMediaStreamSource(this.stream);this.processor=this.audioContext.createScriptProcessor(1024,1,1);this.sink=this.audioContext.createGain();this.sink.gain.value=0;this.processor.onaudioprocess=e=>{if(!this.ready||!this.sendMic||!this.ws||this.ws.readyState!==WebSocket.OPEN)return;const ch=e.inputBuffer.getChannelData(0),down=downsampleBuffer(ch,this.inputRate,16000),bytes=floatTo16BitPCM(down);try{this.ws.send(JSON.stringify({realtimeInput:{audio:{data:bytesToBase64(bytes),mimeType:'audio/pcm;rate=16000'}}}))}catch(_){}};this.source.connect(this.processor);this.processor.connect(this.sink);this.sink.connect(this.audioContext.destination)}
  playPCM(base64,sampleRate=24000){if(!this.audioContext||this.closed)return;try{if(this.audioContext.state==='suspended')this.audioContext.resume().catch(()=>{});const bytes=base64ToBytes(base64),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),length=Math.floor(bytes.byteLength/2),float=new Float32Array(length);for(let i=0;i<length;i++)float[i]=view.getInt16(i*2,true)/32768;const buffer=this.audioContext.createBuffer(1,length,sampleRate);buffer.copyToChannel(float,0);const source=this.audioContext.createBufferSource();source.buffer=buffer;source.connect(this.audioContext.destination);const now=this.audioContext.currentTime,startAt=Math.max(now+0.01,this.nextPlayTime||0);this.nextPlayTime=startAt+buffer.duration;this.playingSources.add(source);source.onended=()=>this.playingSources.delete(source);source.start(startAt)}catch(_){this.cb.onError?.('تعذر تشغيل جزء من الصوت.')}}
  stopPlayback(){for(const source of this.playingSources){try{source.stop()}catch(_){}}this.playingSources.clear();this.nextPlayTime=this.audioContext?.currentTime||0}
  async stop(){this.closed=true;this.ready=false;this.sendMic=false;this.stopPlayback();try{this.processor?.disconnect()}catch(_){}try{this.source?.disconnect()}catch(_){}try{this.sink?.disconnect()}catch(_){}this.processor=null;this.source=null;this.sink=null;try{this.stream?.getTracks?.().forEach(t=>t.stop())}catch(_){}this.stream=null;try{this.ws?.close()}catch(_){}this.ws=null;try{await this.audioContext?.close?.()}catch(_){}this.audioContext=null;this.emitState('idle','جاهز')}
}
