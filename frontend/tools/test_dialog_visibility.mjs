import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../js/theater.js',import.meta.url),'utf8');
function stage(savedDialog='nyala') {
  const listeners={},timers=new Map(),nodes={};let timerId=0,now=0,busy=false;const spoken=[];
  function node(id) {
    const classes=new Set();
    return nodes[id]={hidden:true,textContent:'',dataset:{},style:{},offsetWidth:10,
      classList:{add:c=>classes.add(c),remove:(...cs)=>cs.forEach(c=>classes.delete(c)),contains:c=>classes.has(c),toggle:(c,on)=>on?classes.add(c):classes.delete(c)},
      setAttribute(k,v){this[k]=v;},querySelectorAll:()=>[],
      addEventListener(type,cb){this[type]=cb;}};
  }
  const root=node('panggung'),bubble=node('balon'),right=node('balon-1'),toggle=node('kontrol-dialog'),idle=node('stage-idle-status');
  root.dataset.karakter='gatotkaca';
  const log={voice:[],music:[],sfx:[]};
  const document={body:{dataset:{source:'live'}},getElementById:id=>nodes[id]||null,querySelector:()=>null,querySelectorAll:()=>[],hidden:false,
    addEventListener(type,cb){(listeners[type]||=[]).push(cb);}};
  let modal=false;
  document.querySelector=selector=>selector==='.app[inert]'&&modal?{}:null;
  document.dispatchEvent=()=>{};
  let effect=null;
  let act='live';
  const core={init:()=>({effects:[]}),gesture:()=>({effects:[effect]}),state:()=>act,snapshot:()=>({connected:true})};
  const window={localStorage:{getItem:k=>k==='wayang-dialog'?savedDialog:null,setItem(){}},
    matchMedia:()=>({matches:true}),Dialog:{},TeaterCore:{create:()=>core},
    SuaraDialog:{setEnabled:on=>log.voice.push(on),setPengaturDuck(){},isBicara:()=>busy,
      cancel(){busy=false;},ucap(char,text,hooks){busy=true;spoken.push({char,text,hooks});return true;}},
    Suara:{musik:(...args)=>log.music.push(args),play:cue=>log.sfx.push(cue)}};
  window.WayangMotionCues={};
  window.Suara.playMotion=cue=>{log.sfx.push(cue.sound);return true;};
  window.Suara.unlock=()=>{};window.Suara.setVolume=()=>{};
  const context=vm.createContext({window,document,CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail;}},performance:{now:()=>now},console,
    AudioPrefs:{read:()=>({dialog:.85,musik:.28,sfx:.7})},
    setInterval:()=>0,clearInterval(){},setTimeout:(cb,ms=0)=>{timers.set(++timerId,{cb,at:now+ms});return timerId;},clearTimeout:id=>timers.delete(id)});
  // init applies channel levels through the global aliases used in the app.
  Object.assign(window.Suara,{setChannelVolume(){},setChannelEnabled(){},setEnabled(){}});
  window.SuaraDialog.setVolume=()=>{};
  Object.assign(context,{Suara:window.Suara,SuaraDialog:window.SuaraDialog});
  vm.runInContext(source,context);window.Teater.init();
  return {bubble,right,toggle,log,idle,spoken,api:window.Teater,
    finish(index=spoken.length-1){busy=false;spoken[index]?.hooks.onFinish('ended');},
    advance(ms){const end=now+ms;for(;;){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].cb();}now=end;},
    speaking(value){window.SuaraDialog.isBicara=()=>value;},
    unlock(){listeners.click.forEach(cb=>cb());},
    motion(){listeners['wayang:motion-cue'].forEach(cb=>cb({detail:{sound:'saron',gain:.5,player:0,phase:'accent'}}));},
    sound(cue){effect={type:'sound',cue};listeners['wayang:gesture'].forEach(cb=>cb({detail:{}}));},
    modal(value){modal=value;},hidden(value){document.hidden=value;},
    rest(){act='jeda';},
    gesture(text,delay=0,player=0){effect={type:'bubble',text,delay,player};listeners['wayang:gesture'].forEach(cb=>cb({detail:{}}));},
    flush(){const pending=[...timers];pending.forEach(([id,t])=>{if(timers.has(id)){timers.delete(id);t.cb();}});},
    muteMaster(){window.Teater.setSound(false);}};
}
test('dialog off immediately hides and clears the current bubble without touching music or effects',()=>{
  const s=stage();s.gesture('Cerita pertama');assert.equal(s.bubble.hidden,false);
  const musicCalls=s.log.music.length;s.toggle.click();
  assert.equal(s.bubble.hidden,true);assert.equal(s.bubble.textContent,'');
  assert.equal(s.log.voice.at(-1),false);assert.equal(s.log.music.length,musicCalls);assert.equal(s.log.sfx.length,0);
  s.gesture('Tidak boleh terlihat');s.flush();assert.equal(s.bubble.hidden,true);
});
test('turning dialog off cancels delayed bubbles and turning it on never replays stale text',()=>{
  const s=stage();s.gesture('Tertunda',800);s.toggle.click();s.toggle.click();s.flush();
  assert.equal(s.bubble.hidden,true);assert.equal(s.bubble.textContent,'');
  s.gesture('Cerita baru');assert.equal(s.bubble.hidden,false);assert.equal(s.bubble.textContent,'Cerita baru');
});
test('a saved disabled dialogue preference suppresses bubbles from the first event',()=>{
  const s=stage('mati');s.gesture('Sambutan');s.flush();assert.equal(s.bubble.hidden,true);
  assert.equal(s.toggle['aria-pressed'],'false');
});
test('master sound mute keeps captions available while the dialogue setting stays on',()=>{
  const s=stage();s.muteMaster();s.gesture('Masih boleh dibaca');
  assert.equal(s.bubble.hidden,false);assert.equal(s.toggle['aria-pressed'],'true');
});
test('the waiting indicator stays available with dialogue disabled',()=>{
  const s=stage('mati');s.rest();s.gesture('Tidak tampil');
  assert.equal(s.idle.hidden,false);assert.equal(s.bubble.hidden,true);
});

test('real theater routes phase accents even when Dialog is disabled',()=>{
 const s=stage('mati');s.unlock();s.motion();assert.deepEqual(s.log.sfx,['saron']);assert.equal(s.bubble.hidden,true);
});
test('theater suppresses duplicate immediate gesture sounds but retains scene cues',()=>{
 const s=stage();s.unlock();s.sound('telapak_terbuka');s.sound('jempol');assert.equal(s.log.sfx.length,0);
 s.motion();s.sound('buka');assert.deepEqual(s.log.sfx,['saron','buka']);
});
test('hidden tabs, modal panels and master mute suppress phase playback',()=>{
 const s=stage();s.unlock();s.hidden(true);s.motion();s.hidden(false);s.modal(true);s.motion();s.modal(false);s.muteMaster();s.motion();assert.equal(s.log.sfx.length,0);
});

test('right captions remain visible when P1 voice is busy; each player owns its own lifetime',()=>{
 const s=stage();s.gesture('Kiri',0,0);s.speaking(true);s.gesture('Kanan',0,1);
 assert.equal(s.bubble.textContent,'Kiri');assert.equal(s.right.textContent,'Kanan');assert.equal(s.right.hidden,false);assert.equal(s.right.dataset.player,'1');
 s.toggle.click();assert.equal(s.bubble.hidden,true);assert.equal(s.right.hidden,true);s.flush();assert.equal(s.right.hidden,true);
});
test('a delayed P2 caption cannot cancel or replace a P1 pending caption',()=>{
 const s=stage();s.gesture('Kiri nanti',800,0);s.gesture('Kanan nanti',800,1);s.flush();assert.equal(s.bubble.textContent,'Kiri nanti');assert.equal(s.right.textContent,'Kanan nanti');
});

test('rapid free gestures speak only the most recent stable caption',()=>{
 const s=stage();s.unlock();s.gesture('Lama');s.advance(100);s.gesture('Baru');s.advance(100);s.gesture('Terbaru');
 assert.equal(s.bubble.textContent,'Terbaru');s.advance(279);assert.equal(s.spoken.length,0);
 s.advance(1);assert.deepEqual(s.spoken.map(x=>x.text),['Terbaru']);
 s.gesture('Giliran kanan',0,1);s.advance(280);assert.equal(s.spoken.at(-1).text,'Giliran kanan');
 s.finish(0);assert.equal(s.right.hidden,false,'stale completion cannot retire a newer voice');
});
test('caption and story readiness wait for actual voice completion beyond the reading timer',()=>{
 const s=stage();s.unlock();s.api.say({player:1,text:'Aku masih berbicara.',source:'story'});s.advance(0);
 assert.equal(s.spoken.length,1);s.advance(9000);assert.equal(s.right.hidden,false);assert.equal(s.api.dialogueBusy(),true);
 s.finish();assert.equal(s.api.dialogueBusy(),false);s.advance(350);assert.equal(s.right.hidden,true);
});
test('stop, dialog off and superseding text cannot resurrect a delayed voice',()=>{
 const s=stage();s.unlock();s.gesture('Jangan diputar');s.api.stopVoice();s.advance(5000);assert.equal(s.spoken.length,0);
 s.gesture('Sedang bicara');s.advance(280);s.toggle.click();s.finish();s.advance(5000);
 assert.equal(s.bubble.hidden,true);assert.equal(s.right.hidden,true);assert.equal(s.api.dialogueBusy(),false);
});
test('muted captions use reading time, never wait forever for an unavailable voice',()=>{
 const s=stage();s.muteMaster();s.gesture('Bisa dibaca tanpa suara.');s.advance(2000);assert.equal(s.api.dialogueBusy(),true);
 s.advance(1000);assert.equal(s.api.dialogueBusy(),false);assert.equal(s.bubble.hidden,true);assert.equal(s.spoken.length,0);
});
