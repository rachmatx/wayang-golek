/* One dialogue owner across recorded audio and TTS. Transport callbacks are
 * generation-checked; completion/cancellation settles exactly once. */
(function () {
  "use strict";
  const PROFIL = {
    klasik: { rate: 0.95, pitch: 1.0 },
    arjuna: { rate: 0.82, pitch: 0.82 },
    gatotkaca: { rate: 1.0, pitch: 0.62 },
    semar: { rate: 0.86, pitch: 0.78 },
    bagong: { rate: 1.12, pitch: 1.18 },
    cepot: { rate: 1.22, pitch: 1.3 },
  };


  let enabled=true, volume=1, active=null, nextId=0, pengaturDuck=null;
  const badFiles=new Set();
  const script=documentSafe();
  const base=script ? script.replace(/js\/voice\.js.*$/, '')+'assets/audio/' : 'assets/audio/';
  function documentSafe(){try{return document.currentScript&&document.currentScript.src;}catch(_){return null;}}
  function timer(fn,ms){const t=setTimeout(fn,ms);if(t&&t.unref)t.unref();return t;}
  function current(s,g){return active===s&&(g===undefined||s.generation===g);}
  function stopTransport(s){
    clearTimeout(s.timer);s.generation++;
    if(s.audio){try{s.audio.pause();s.audio.removeAttribute('src');s.audio.load();}catch(_){}s.audio=null;}
    if(s.utterance){s.utterance.onstart=s.utterance.onend=s.utterance.onerror=()=>{};s.utterance=null;
      try{window.speechSynthesis.cancel();}catch(_){} }
  }
  function finish(s,reason,stop=false){
    if(!current(s))return;
    // Invalidate before pause/load/cancel, which can synchronously dispatch errors.
    active=null;if(stop)stopTransport(s);else clearTimeout(s.timer);
    if(pengaturDuck)pengaturDuck(false);
    if(s.hooks.onFinish)s.hooks.onFinish(reason);
  }
  function cancel(){if(active)finish(active,'cancelled',true);}
  function started(s,g){
    if(!current(s,g))return;
    clearTimeout(s.timer);
    // A missing end/error event must not lock the entire performance indefinitely.
    const seconds=s.audio&&Number.isFinite(s.audio.duration)?s.audio.duration:Math.max(5,s.text.length/9);
    s.timer=timer(()=>finish(s,'timeout',true),Math.min(60000,Math.max(15000,(seconds*2+5)*1000)));
    if(!s.started){s.started=true;if(pengaturDuck)pengaturDuck(true);if(s.hooks.onStart)s.hooks.onStart();}
  }
  function tts(s){
    const synth=window.speechSynthesis, Utterance=window.SpeechSynthesisUtterance;
    if(!synth||typeof synth.speak!=='function'||!Utterance){finish(s,'unavailable');return false;}
    const g=++s.generation, u=new Utterance(s.text),profile=PROFIL[s.key]||PROFIL.klasik;
    s.utterance=u;u.lang='id-ID';u.volume=volume;u.rate=profile.rate;u.pitch=profile.pitch;
    const voices=typeof synth.getVoices==='function'?synth.getVoices()||[]:[];
    const voice=voices.find(v=>String(v.lang||'').toLowerCase().startsWith('id'));if(voice)u.voice=voice;
    u.onstart=()=>started(s,g);
    u.onend=()=>{if(current(s,g))finish(s,'ended');};
    u.onerror=()=>{if(current(s,g))finish(s,'error',true);};
    s.timer=timer(()=>finish(s,'timeout',true),5000);
    try{synth.speak(u);return true;}catch(_){finish(s,'error',true);return false;}
  }
  function clip(s,path){
    let el;try{el=new window.Audio();}catch(_){return tts(s);}
    s.audio=el;const g=++s.generation;
    function fallback(){
      if(!current(s,g))return;
      badFiles.add(path);stopTransport(s);tts(s);
    }
    el.preload='auto';el.volume=volume;el.src=base+path;
    el.addEventListener('playing',()=>started(s,g));
    el.addEventListener('ended',()=>{if(current(s,g))finish(s,'ended');});
    el.addEventListener('error',fallback);
    s.timer=timer(fallback,4000);
    try{const promise=el.play();if(promise&&promise.catch)promise.catch(fallback);}catch(_){fallback();}
    return true;
  }
  function ucap(key,text,hooks={}){
    text=typeof text==='string'?text.trim():'';
    if(!enabled||volume===0||!text||active)return false;
    const s={id:++nextId,key,text,hooks,generation:0,started:false};active=s;
    const path=window.DialogAudio&&window.DialogAudio[key]&&window.DialogAudio[key][text];
    try{return path&&!badFiles.has(path)&&typeof window.Audio==='function'?clip(s,path):tts(s);}
    catch(_){finish(s,'error',true);return false;}
  }
  function setEnabled(on){enabled=!!on;if(!enabled)cancel();}
  function setVolume(value){
    value=Number(value);if(!Number.isFinite(value))return;
    const next=Math.max(0,Math.min(1,value));if(next===volume)return;volume=next;
    if(active&&active.audio)active.audio.volume=volume;
    if(active&&(active.utterance||volume===0))cancel();
  }
  window.SuaraDialog={ucap,cancel,setEnabled,setVolume,volume:()=>volume,enabled:()=>enabled,isBicara:()=>!!active,
    setPengaturDuck:fn=>{pengaturDuck=typeof fn==='function'?fn:null;}};
})();
