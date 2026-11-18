/* Exercise actual app handlers against the real slot allocator and theater core.
 * Only the DOM/puppet rendering and transport are replaced, not input logic.
 */
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';
const req=createRequire(import.meta.url),I=req('../js/input-core.js'),Slots=req('../js/slots.js'),Theater=req('../js/theater-core.js');
function setup(count=2){
 const source=readFileSync(new URL('../js/app.js',import.meta.url),'utf8').replace('document.addEventListener("DOMContentLoaded", boot);','window.TestApp={app, input, handlePrediction, onSocketMessage, performanceStage, onDummyGesture, onDummyToggle, onSocketStatus, applyHealth};');
 let now=1000,sequence=0;const timers=new Map(),events=[],poses=[[],[]],wrist=[[],[]],views=[];
 const core=Theater.create({dialog:{}});core.init({now:0});core.open('gesture',now);
 const img={src:''},ribbon={hidden:true};const document={body:{dataset:{source:'live'}},getElementById:id=>id==='video-feed'?img:id==='pita-terputus'?ribbon:null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},
  dispatchEvent(e){events.push(e);if(e.type==='wayang:hand')core.hand(now);if(e.type==='wayang:nohand')core.noHand(now);if(e.type==='wayang:connection')core.connection(e.detail.state,now);if(e.type==='wayang:gesture')core.gesture(e.detail,now);}};
 const Panel=new Proxy({setInputStatus:v=>views.push(v)},{get:(obj,key)=>obj[key]||(()=>{})});
 const Wayang={labelFor:g=>g,poseFor:g=>g==='jempol'?{mode:'auto',resetMs:2200}:g==='ok'?{mode:'toggle'}:{mode:'hold'}};
 const Teater={isReading:()=>false,open:()=>core.open('button',now),setCamera(){}};
 const window={Wayang,Teater};
 const context=vm.createContext({window,document,Panel,Wayang,Teater,InputCore:I,console,performance:{now:()=>now},
  CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail;}},
  setTimeout:cb=>{timers.set(++sequence,cb);return sequence;},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(source,context);
 const api=window.TestApp;api.app.jumlah=count;api.app.slots=Slots({jumlah:count});api.app.storySlots=Slots({jumlah:1});
 api.app.players=[0,1].map(index=>({index,karakter:'gatotkaca',loaded:true,gesture:null,lastGesture:null,handPresent:false,noHandTimer:null,autoTimer:null,
  wayang:{applyPose:(...a)=>poses[index].push(a),setWrist:x=>wrist[index].push(x),toggleFacing(){}}}));
 api.onSocketStatus('connected');
 const packet=hands=>api.handlePrediction({type:'prediction',hands,camera:true,model_loaded:true,model:'mlp',fps:30});
 return {api,core,events,poses,wrist,views,timers,ribbon,packet,context,window,document,Teater,setLakon:guard=>{window.Lakon=guard;context.Lakon=guard;},at:t=>{now=t;},tick:t=>{now=t;core.tick(t);}};
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

function mountLakon(s) {
 const nodes=new Map(),listeners=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,dataset:{},style:{},classList:{toggle(){}},setAttribute(){},removeAttribute(){},focus(){},scrollIntoView(){},addEventListener(name,cb){this[name]=cb;}});return nodes.get(id);};
 s.document.getElementById=node;s.document.querySelector=selector=>selector==='.app[inert]'?null:selector.startsWith('[data-jumlah')?null:node(selector);
 s.document.addEventListener=(name,cb)=>{if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(cb);};
 const dispatch=s.document.dispatchEvent;s.document.dispatchEvent=event=>{dispatch(event);(listeners.get(event.type)||[]).forEach(cb=>cb(event));};
 let practice=false,player=0;
 const dummy={stopMotion(){},setJumlah(){},isActive:()=>practice,player:()=>player,setPemain:p=>{player=p;},setActive:v=>{practice=v;s.api.onDummyToggle(v);}};
 Object.assign(s.Teater,{stopVoice(){},resetInput:()=>s.core.resetGestures()});
 s.api.app.players.forEach(p=>Object.assign(p.wayang,{position:()=>.5,facing:()=>1,setFacing(){},setLane(){},setStageTarget(){},restorePosition(){}}));
 s.context.Dummy=dummy;s.window.Dummy=dummy;s.context.WayangPerformance=req('../js/performance-core.js');
 s.context.MutationObserver=class{observe(){}};s.context.setInterval=()=>0;
 vm.runInContext(readFileSync(new URL('../js/performance.js',import.meta.url),'utf8'),s.context);
 s.context.Lakon=s.window.Lakon;
 (listeners.get('DOMContentLoaded')||[]).forEach(cb=>cb());
 s.document.dispatchEvent({type:'wayang:ready',detail:{stage:s.api.performanceStage()}});
 return {dummy,click:id=>node('performance-'+id).click(),camera:hand=>s.api.onSocketMessage({type:'prediction',hands:[hand],camera:true,model_loaded:true,model:'mlp',fps:30})};
}
test('real lakon coordinator + app keeps live camera through play, watch and exit',async()=>{
 const s=setup(1),ui=mountLakon(s);
 ui.camera(hand(1,.85));assert.equal(s.poses[0].length,1);
 await ui.click('play');assert.equal(s.api.app.source,'live');assert.equal(ui.dummy.isActive(),false);assert.equal(s.window.Lakon.isPlaying(),true);
 const before=s.poses[0].length;ui.camera(hand(1,.88));assert.equal(s.poses[0].length,before+1);assert.equal(s.api.input.hands[0].id,1);
 await ui.click('exit');assert.equal(s.window.Lakon.isActive(),false);assert.equal(s.api.app.jumlah,1);assert.equal(s.api.app.source,'live');
 const exited=s.poses[0].length;ui.camera(hand(1,.88));assert.equal(s.poses[0].length,exited+1);
 await ui.click('watch');assert.equal(s.api.app.source,'live');const watching=s.poses[0].length;
 ui.camera(hand(1,.88,'dua_jari'));assert.equal(s.poses[0].length,watching);assert.equal(s.api.input.hands.filter(Boolean).length,1);
 await ui.click('exit');const final=s.poses[0].length;ui.camera(hand(1,.88,'dua_jari'));assert.equal(s.poses[0].length,final+1);
});
test('guided P1 owns a lone right-side hand and retains it when another hand appears',()=>{
 const s=setup();s.setLakon({isActive:()=>true,isPlaying:()=>true,allowInput:(p,source)=>source==='story'||p===0});
 s.packet([hand(10,.91)]);assert.equal(s.api.input.hands[0].id,10);assert.equal(s.poses[0].length,1);assert.equal(s.poses[1].length,0);
 s.packet([hand(11,.1,'dua_jari'),hand(10,.65,'telunjuk')]);assert.equal(s.api.input.hands[0].id,10);assert.equal(s.poses[1].length,0);
});
test('explicit practice source is preserved when entering and leaving the story',async()=>{
 const s=setup(2),ui=mountLakon(s);ui.dummy.setActive(true);ui.dummy.setPemain(1);
 await ui.click('watch');await ui.click('exit');assert.equal(ui.dummy.isActive(),true);assert.equal(ui.dummy.player(),1);assert.equal(s.api.app.source,'dummy');
});

test('connection feedback is resynchronized after leaving a disconnected watch session',async()=>{
 const s=setup(1),ui=mountLakon(s);await ui.click('watch');s.api.onSocketStatus('disconnected');
 assert.equal(s.document.getElementById('pita-terputus').hidden,true);
 await ui.click('exit');assert.equal(s.api.app.source,'live');assert.equal(s.document.getElementById('pita-terputus').hidden,false);assert.equal(s.core.snapshot().connected,false);
});
