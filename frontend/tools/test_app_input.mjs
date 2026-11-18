/* Exercise actual app handlers against the real slot allocator and theater core.
 * Only the DOM/puppet rendering and transport are replaced, not input logic.
 */
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';
const req=createRequire(import.meta.url),I=req('../js/input-core.js'),Slots=req('../js/slots.js'),Theater=req('../js/theater-core.js');
function setup(count=2){
 const source=readFileSync(new URL('../js/app.js',import.meta.url),'utf8').replace('document.addEventListener("DOMContentLoaded", boot);','window.TestApp={app, input, handlePrediction, onDummyGesture, onDummyToggle, onSocketStatus, applyHealth};');
 let now=1000,sequence=0;const timers=new Map(),events=[],poses=[[],[]],wrist=[[],[]],views=[];
 const core=Theater.create({dialog:{}});core.init({now:0});core.open('gesture',now);
 const img={src:''},ribbon={hidden:true};const document={body:{dataset:{source:'live'}},getElementById:id=>id==='video-feed'?img:id==='pita-terputus'?ribbon:null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},
  dispatchEvent(e){events.push(e);if(e.type==='wayang:hand')core.hand(now);if(e.type==='wayang:nohand')core.noHand(now);if(e.type==='wayang:gesture')core.gesture(e.detail,now);}};
 const Panel=new Proxy({setInputStatus:v=>views.push(v)},{get:(obj,key)=>obj[key]||(()=>{})});
 const Wayang={labelFor:g=>g,poseFor:g=>g==='jempol'?{mode:'auto',resetMs:2200}:g==='ok'?{mode:'toggle'}:{mode:'hold'}};
 const Teater={isReading:()=>false,open:()=>core.open('button',now),setCamera(){}};
 const window={Wayang,Teater};
 const context=vm.createContext({window,document,Panel,Wayang,Teater,InputCore:I,console,performance:{now:()=>now},
  CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail;}},
  setTimeout:cb=>{timers.set(++sequence,cb);return sequence;},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(source,context);
 const api=window.TestApp;api.app.jumlah=count;api.app.slots=Slots({jumlah:count});
 api.app.players=[0,1].map(index=>({index,karakter:'gatotkaca',loaded:true,gesture:null,lastGesture:null,handPresent:false,noHandTimer:null,autoTimer:null,
  wayang:{applyPose:(...a)=>poses[index].push(a),setWrist:x=>wrist[index].push(x),toggleFacing(){}}}));
 api.onSocketStatus('connected');
 const packet=hands=>api.handlePrediction({type:'prediction',hands,camera:true,model_loaded:true,model:'mlp',fps:30});
 return {api,core,events,poses,wrist,views,timers,ribbon,packet,setLakon:guard=>{window.Lakon=guard;context.Lakon=guard;},at:t=>{now=t;},tick:t=>{now=t;core.tick(t);}};
}
const hand=(id,x,gesture='telapak_terbuka',state='ok')=>({id,wrist_x:x,gesture,state,confidence:.95});
test('P2 leaving does not pause P1 or emit a global no-hand event',()=>{
 const s=setup();s.packet([hand(1,.2),hand(2,.8)]);s.events.length=0;s.at(2000);s.packet([hand(1,.2)]);s.tick(5000);
 assert.equal(s.core.state(),'live');assert.equal(s.events.filter(e=>e.type==='wayang:nohand').length,0);
 assert.equal(s.api.app.players[0].handPresent,true);assert.equal(s.api.app.players[1].handPresent,false);
});
test('leaving the last player starts one pause; either player can resume it',()=>{
 const s=setup();s.packet([hand(1,.2),hand(2,.8)]);s.at(2000);s.packet([]);s.packet([]);s.tick(4000);
 assert.equal(s.core.state(),'jeda');assert.equal(s.events.filter(e=>e.type==='wayang:nohand').length,1);
 s.at(5000);s.packet([hand(3,.8)]);assert.equal(s.core.state(),'live');
});
test('an uncertain visible hand stays present without retriggering the puppet',()=>{
 const s=setup(1);s.packet([hand(1,.2)]);const before=s.poses[0].length;s.at(2000);s.packet([hand(1,.2,null,'unknown')]);s.tick(5000);
 assert.equal(s.core.state(),'live');assert.equal(s.poses[0].length,before);assert.equal(s.views.at(-1).state,'holding');
});
test('repeated camera labels trigger once but wrist updates keep flowing',()=>{
 const s=setup(1);s.packet([hand(1,.2,'telunjuk')]);s.packet([hand(1,.7,'telunjuk')]);
 assert.equal(s.poses[0].length,1);assert.deepEqual(s.wrist[0],[.2,.7]);
});
test('practice buttons replay the same phrase and replace its auto-reset timer',()=>{
 const s=setup(1);s.api.onDummyToggle(true);s.api.onDummyGesture({player:0,gesture:'jempol',wrist:.5});s.api.onDummyGesture({player:0,gesture:'jempol',wrist:.5});
 assert.equal(s.poses[0].length,2);assert.equal(s.poses[0][1][1],true);assert.equal(s.timers.size,1);
});
test('practice stays labeled correctly when live health checks report a missing camera',()=>{
 const s=setup(1);s.api.onDummyToggle(true);s.api.applyHealth({camera:false,camera_aktif:true,model_loaded:true,components:{mediapipe:true}});
 assert.equal(s.views.at(-1).state,'practice');s.api.onDummyToggle(false);assert.equal(s.views.at(-1).state,'unavailable');
});
test('health separates an intentional off state from an unavailable device',()=>{
 const s=setup(1);s.api.applyHealth({camera:false,camera_aktif:false,model_loaded:true});assert.equal(s.views.at(-1).state,'off');
 s.api.applyHealth({camera:false,camera_aktif:true,model_loaded:true});assert.equal(s.views.at(-1).state,'unavailable');
});
test('a backend disconnect does not interrupt practice or leave its warning ribbon visible',()=>{
 const s=setup(1);s.api.onDummyToggle(true);s.events.length=0;s.api.onSocketStatus('disconnected');
 assert.equal(s.ribbon.hidden,true);assert.equal(s.views.at(-1).state,'practice');
 assert.equal(s.events.some(e=>e.type==='wayang:connection'),false);
 s.api.onDummyToggle(false);assert.equal(s.ribbon.hidden,false);assert.equal(s.views.at(-1).state,'disconnected');
});
test('watch mode gates camera wrist updates, missing-hand timers and practice input',()=>{
 const s=setup();s.api.onDummyToggle(true);
 // Inject only the public mode guard, then exercise production handlers as usual.
 s.api.app.players.forEach(p=>p.lastGesture='telunjuk');
 s.setLakon({isActive:()=>true,allowInput:()=>false});
 s.packet([hand(1,.2,'telunjuk')]);s.packet([]);s.api.onDummyGesture({player:0,gesture:'jempol',wrist:.5});
 assert.equal(s.poses[0].length,0);assert.equal(s.wrist[0].length,0);assert.equal(s.timers.size,0);
 assert.equal(s.events.some(e=>e.type==='wayang:nohand'),false);
});

test('guided play accepts P1 but never lets live or practice P2 override the reply',()=>{
 const s=setup();s.setLakon({isActive:()=>true,allowInput:(player,source)=>source==='story'||player===0});
 s.packet([hand(1,.2,'dua_jari'),hand(2,.8,'ok')]);
 assert.equal(s.poses[0].length,1);assert.equal(s.poses[1].length,0);
 s.api.onDummyGesture({player:1,gesture:'jempol',wrist:.5});assert.equal(s.poses[1].length,0);
 s.api.onDummyGesture({player:0,gesture:'jempol',wrist:.5});assert.equal(s.timers.size,0);
});
