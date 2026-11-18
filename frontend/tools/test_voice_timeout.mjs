import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
function setup(){
 let now=0,id=0,utterance,cancelled=0;const timers=new Map(),finished=[];
 const window={SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},speechSynthesis:{speak:u=>utterance=u,cancel:()=>cancelled++,getVoices:()=>[]}};
 vm.runInNewContext(readFileSync(new URL('../js/voice.js',import.meta.url),'utf8'),{window,setTimeout:(cb,ms)=>{timers.set(++id,{at:now+ms,cb});return id;},clearTimeout:id=>timers.delete(id)});
 return {window,finished,get utterance(){return utterance;},get cancelled(){return cancelled;},say:()=>window.SuaraDialog.ucap('semar','Halo teman',{onFinish:r=>finished.push(r)}),
  advance(ms){const end=now+ms;for(;;){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].cb();}now=end;}};
}
test('missing TTS start releases transport and allows the next line',()=>{
 const s=setup();s.say();s.advance(4999);assert.equal(s.window.SuaraDialog.isBicara(),true);
 const late=s.utterance.onstart;s.advance(1);assert.deepEqual(s.finished,['timeout']);assert.equal(s.cancelled,1);
 assert.equal(s.say(),true);late();assert.equal(s.window.SuaraDialog.isBicara(),true);
});
test('missing end releases a started voice; a real end clears its watchdog',()=>{
 const s=setup();s.say();s.utterance.onstart();s.advance(14999);assert.deepEqual(s.finished,[]);
 s.advance(1);assert.deepEqual(s.finished,['timeout']);s.say();s.utterance.onstart();s.utterance.onend();s.advance(60000);
 assert.deepEqual(s.finished,['timeout','ended']);assert.equal(s.window.SuaraDialog.isBicara(),false);
});
