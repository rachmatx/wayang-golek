import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const req=createRequire(import.meta.url),M=req('../js/motion-cues.js'),P=req('../js/puppetry-core.js');
function run(pose,tempo,fps,seconds=6){const m=M.create();m.reset(pose);const cues=[];for(let n=0;n<fps*seconds;n++)m.sample(n/fps,{tempo}).forEach(c=>cues.push({...c,time:n/fps}));return cues;}
test('each authored marker fires once at its character tempo across frame rates',()=>{
 for(const pose of Object.keys(M.markers))for(const profile of Object.values(P.profiles))for(const fps of [30,60,120]) {
  const cues=run(pose,profile.tempo,fps);assert.equal(cues.length,M.markers[pose].length);
  cues.forEach((cue,i)=>{assert.equal(cue.phase,M.markers[pose][i][1]);assert.ok(Math.abs(cue.time-M.markers[pose][i][0]/profile.tempo)<=1/fps+.00001);});
 }
});
test('holding a greeting never creates a repeating sound loop',()=>{
 assert.equal(run('telapak_terbuka',1,60,60).length,3);
});
test('interrupting a phrase discards its remaining markers and allows deliberate replay',()=>{
 const m=M.create();m.reset('jempol');assert.equal(m.sample(.3,{tempo:1}).length,1);
 m.reset('netral');assert.deepEqual(m.sample(5,{tempo:1}),[]);
 m.reset('jempol');assert.equal(m.sample(.7,{tempo:1}).length,2);
});
test('pointing in place is silent, actual travel emits at most one soft step per frame',()=>{
 const m=M.create();m.reset('telunjuk');for(let i=0;i<100;i++)assert.deepEqual(m.sample(i/60,{stride:0,speed:0}),[]);
 assert.equal(m.sample(2,{stride:Math.PI+.1,speed:80})[0].phase,'step');
 assert.deepEqual(m.sample(2.1,{stride:Math.PI+.1,speed:0}),[]);
 assert.equal(m.sample(2.2,{stride:Math.PI*10,speed:100}).length,1);
});
test('reduced motion gets one restrained accent and no walking rhythm',()=>{
 for(const pose of Object.keys(M.markers)){
  const m=M.create();m.reset(pose);assert.deepEqual(m.sample(0,{reduced:true}),[]);assert.equal(m.sample(.1,{reduced:true}).length,1);assert.deepEqual(m.sample(10,{reduced:true}),[]);
 }
 const m=M.create();m.reset('telunjuk');assert.deepEqual(m.sample(1,{reduced:true,stride:10,speed:500}),[]);
});
test('separate players retain their own markers, including identical duet greetings',()=>{
 const a=M.create(),b=M.create();a.reset('telapak_terbuka');b.reset('telapak_terbuka');
 assert.equal(a.sample(.55,{tempo:1}).length,2);assert.equal(b.sample(.55,{tempo:1}).length,2);assert.deepEqual(a.sample(.6,{tempo:1}),[]);
});
