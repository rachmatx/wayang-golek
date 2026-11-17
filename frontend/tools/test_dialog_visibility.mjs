import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../js/theater.js',import.meta.url),'utf8');
function stage(savedDialog='nyala') {
  const listeners={},timers=new Map(),nodes={};let timerId=0;
  function node(id) {
    const classes=new Set();
    return nodes[id]={hidden:true,textContent:'',dataset:{},style:{},offsetWidth:10,
      classList:{add:c=>classes.add(c),remove:(...cs)=>cs.forEach(c=>classes.delete(c)),contains:c=>classes.has(c),toggle:(c,on)=>on?classes.add(c):classes.delete(c)},
      setAttribute(k,v){this[k]=v;},querySelectorAll:()=>[],
      addEventListener(type,cb){this[type]=cb;}};
  }
  const root=node('panggung'),bubble=node('balon'),toggle=node('kontrol-dialog');
  root.dataset.karakter='gatotkaca';
  const log={voice:[],music:[],sfx:[]};
  const document={getElementById:id=>nodes[id]||null,querySelector:()=>null,querySelectorAll:()=>[],hidden:false,
    addEventListener(type,cb){(listeners[type]||=[]).push(cb);}};
  let effect=null;
  const core={init:()=>({effects:[]}),gesture:()=>({effects:[effect]}),state:()=> 'live',snapshot:()=>({connected:true})};
  const window={localStorage:{getItem:k=>k==='wayang-dialog'?savedDialog:null,setItem(){}},
    matchMedia:()=>({matches:true}),Dialog:{},TeaterCore:{create:()=>core},
    SuaraDialog:{setEnabled:on=>log.voice.push(on),setPengaturDuck(){},isBicara:()=>false,ucap(){}},
    Suara:{musik:(...args)=>log.music.push(args),play:cue=>log.sfx.push(cue)}};
  const context=vm.createContext({window,document,performance:{now:()=>0},console,
    AudioPrefs:{read:()=>({dialog:.85,musik:.28,sfx:.7})},
    setInterval:()=>0,clearInterval(){},setTimeout:cb=>{timers.set(++timerId,cb);return timerId;},clearTimeout:id=>timers.delete(id)});
  // init applies channel levels through the global aliases used in the app.
  Object.assign(window.Suara,{setChannelVolume(){},setChannelEnabled(){},setEnabled(){}});
  window.SuaraDialog.setVolume=()=>{};
  Object.assign(context,{Suara:window.Suara,SuaraDialog:window.SuaraDialog});
  vm.runInContext(source,context);window.Teater.init();
  return {bubble,toggle,log,
    gesture(text,delay=0){effect={type:'bubble',text,delay};listeners['wayang:gesture'].forEach(cb=>cb({detail:{}}));},
    flush(){const pending=[...timers.values()];timers.clear();pending.forEach(cb=>cb());},
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
