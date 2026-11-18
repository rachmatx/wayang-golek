/* Drive the real coordinator with minimal DOM and a staging adapter spy. */
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';
const P=createRequire(import.meta.url)('../js/performance-core.js');
function setup(prepare=async()=>{}) {
 const events=new Map(),nodes=new Map(),intervals=[],calls=[];let now=1000,modal=false,observe;
 const node=id=>{
  if(!nodes.has(id))nodes.set(id,{id,hidden:false,inert:false,disabled:false,dataset:{},style:{},textContent:'',innerHTML:'',classList:{toggle(){}},
    setAttribute(){},removeAttribute(){},focus(){calls.push(['focus',id]);},scrollIntoView(){},addEventListener(type,fn){this[type]=fn;}});
  return nodes.get(id);
 };
 const document={hidden:false,getElementById:node,querySelector:s=>s==='.app[inert]'?(modal?node('app'):null):node(s),addEventListener:(name,cb)=>events.set(name,cb)};
 const saved={jumlah:1,practice:false,player:0};
 const stage={snapshot:()=>saved,prepare:async()=>{calls.push(['prepare']);await prepare();},perform:c=>calls.push(['perform',c]),
  cancel:()=>calls.push(['cancel']),freeze:()=>calls.push(['freeze']),neutral:()=>calls.push(['neutral']),restore:async s=>{calls.push(['restore',s]);}};
 const window={};const context=vm.createContext({window,document,WayangPerformance:P,Wayang:{labelFor:g=>g},performance:{now:()=>now},
  Teater:{stopVoice:()=>calls.push(['voice-stop'])},Dummy:{setPemain:p=>calls.push(['player',p])},MutationObserver:class{constructor(cb){observe=cb;}observe(){}},setInterval:fn=>intervals.push(fn)});
 vm.runInContext(readFileSync(new URL('../js/performance.js',import.meta.url),'utf8'),context);
 events.get('DOMContentLoaded')();events.get('wayang:ready')({detail:{stage}});
 const tick=n=>{for(let i=0;i<n;i++){now+=100;intervals.forEach(fn=>fn());}};
 return {calls,node,document,api:window.Lakon,tick,click:id=>node('performance-'+id).click(),modal:value=>{modal=value;observe();},
  gesture:(player,gesture,source='dummy')=>events.get('wayang:gesture')({detail:{player,gesture,source}})};
}
test('watch is isolated; takeover waits for P1; exit restores the original context once',async()=>{
 const s=setup();await s.click('watch');assert.equal(s.api.isActive(),true);assert.equal(s.api.allowInput(0,'live'),false);assert.equal(s.api.allowInput(1,'dummy'),false);
 s.click('takeover');assert.equal(s.api.allowInput(0,'dummy'),true);assert.equal(s.api.allowInput(1,'live'),false);
 const before=s.calls.filter(c=>c[0]==='perform').length;s.tick(200);assert.equal(s.calls.filter(c=>c[0]==='perform').length,before);
 s.gesture(0,'telapak_terbuka');s.tick(25);assert.equal(s.calls.filter(c=>c[0]==='perform').length,before+2);
 await s.click('exit');s.tick(200);assert.equal(s.api.isActive(),false);assert.equal(s.api.allowInput(1,'live'),true);
 assert.equal(s.node('kontrol-jumlah').inert,false);assert.equal(s.node('dummy').inert,false);
 assert.equal(s.calls.filter(c=>c[0]==='restore').length,1);assert.equal(s.calls.at(-2)[0],'restore');
});
test('manual, modal and hidden pauses overlap without advancing or double responses',async()=>{
 const s=setup();await s.click('watch');s.tick(5);s.click('pause');s.modal(true);s.click('pause');
 const before=s.calls.filter(c=>c[0]==='perform').length;s.tick(100);assert.equal(s.api.isPaused(),true);
 assert.equal(s.calls.filter(c=>c[0]==='perform').length,before);s.document.hidden=true;s.modal(false);s.tick(50);assert.equal(s.api.isPaused(),true);
 s.document.hidden=false;s.tick(25);assert.equal(s.calls.filter(c=>c[0]==='perform').length,before+1);
});
test('cancel during asset loading restores instead of starting late choreography',async()=>{
 let resolve;const s=setup(()=>new Promise(r=>resolve=r));const loading=s.click('watch');
 assert.equal(s.api.isPaused(),true);await s.click('exit');assert.match(s.node('performance-status').textContent,/Membatalkan/);
 resolve();await loading;assert.equal(s.api.isActive(),false);assert.equal(s.calls.filter(c=>c[0]==='perform').length,0);assert.equal(s.calls.filter(c=>c[0]==='restore').length,1);
});
test('failed setup unlocks the app and provides a retry message',async()=>{
 const s=setup(async()=>{throw Error('Tokoh kedua gagal dimuat.');});await s.click('watch');
 assert.equal(s.api.isActive(),false);assert.equal(s.node('kontrol-wayang-0').inert,false);assert.match(s.node('performance-intro').textContent,/Coba|mencoba/);
});
test('restart replaces the current beat and cannot carry a pending reply',async()=>{
 const s=setup();await s.click('watch');s.tick(10);await s.click('repeat');
 const before=s.calls.filter(c=>c[0]==='perform').length;s.tick(5);assert.equal(s.calls.filter(c=>c[0]==='perform').length,before);
 s.tick(20);assert.equal(s.calls.filter(c=>c[0]==='perform').length,before+1);
});
