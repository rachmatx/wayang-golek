/* QA only: deterministic slow transports, exercised through production voice.js. */
(function(){
 let current=null,serial=0;
 const notify=(kind,session)=>parent.postMessage({type:'qa-dialogue',kind,id:session.id,text:session.text,time:performance.now(),
   captions:[...document.querySelectorAll('.balon:not([hidden])')].map(n=>n.textContent),step:document.getElementById('performance-act')?.textContent},new URL(document.baseURI).origin);
 function stop(){if(!current)return;const s=current;current=null;clearTimeout(s.start);clearTimeout(s.end);notify('cancel',s);}
 function begin(text,start,end){
   if(current)notify('overlap',current);
   const s={id:++serial,text};current=s;notify('request',s);
   s.start=setTimeout(()=>{if(current!==s)return;notify('start',s);start();
     s.end=setTimeout(()=>{if(current!==s)return;current=null;notify('end',s);end();},6000);
   },400);
 }
 Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[],cancel:stop,
   speak:u=>begin(u.text,()=>u.onstart?.(),()=>u.onend?.())}});
 window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
 window.Audio=class{
   constructor(){this.events={};this.duration=6;}
   addEventListener(k,cb){this.events[k]=cb;}
   play(){begin(this.src,()=>this.events.playing?.(),()=>this.events.ended?.());return Promise.resolve();}
   pause(){stop();}removeAttribute(){}load(){}
 };
})();
