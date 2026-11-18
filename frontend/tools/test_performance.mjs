import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const P=createRequire(import.meta.url)('../js/performance-core.js');
const run=(core,seconds,paused=false)=>{const cues=[];for(let n=0;n<seconds*100;n++)cues.push(...core.tick(.01,paused));return cues;};
test('watch has three acts, all six gestures, exactly 72 seconds and one response per beat',()=>{
 const p=P.create(),cues=p.start('watch');cues.push(...run(p,72));
 assert.equal(p.state().done,true);assert.equal(cues.filter(c=>c.type==='perform'&&c.player===0).length,9);
 assert.equal(cues.filter(c=>c.type==='perform'&&c.player===1).length,9);
 assert.equal(cues.filter(c=>c.type==='complete').length,1);assert.equal(new Set(P.beats.map(b=>b.act)).size,3);
 assert.equal(new Set(P.beats.map(b=>b.gesture)).size,6);assert.deepEqual(p.tick(.1,false),[]);
});
test('play waits without timeout and accepts only the correct P1 gesture once',()=>{
 const p=P.create();assert.equal(p.start('play').length,1);run(p,120);
 assert.equal(p.state().index,0);assert.deepEqual(p.input(1,'telapak_terbuka'),[]);assert.deepEqual(p.input(0,'ok'),[]);
 assert.equal(p.input(0,'telapak_terbuka')[0].manual,true);assert.deepEqual(p.input(0,'telapak_terbuka'),[]);
 const cues=run(p,8);assert.equal(cues.filter(c=>c.player===1).length,1);assert.equal(p.state().index,1);assert.equal(p.state().accepted,false);
});
test('overlapping pauses freeze the clock and never produce a delayed response',()=>{
 const p=P.create();p.start('watch');run(p,1);const elapsed=p.state().elapsed;
 assert.deepEqual(run(p,60,true),[]);assert.equal(p.state().elapsed,elapsed);
 const cues=run(p,.7);assert.equal(cues.filter(c=>c.player===1).length,1);
});
test('skip, repeat and exit discard pending replies',()=>{
 const p=P.create();p.start('watch');run(p,1);p.skip();
 assert.equal(p.state().index,1);assert.deepEqual(run(p,.5),[]);
 p.start('play');assert.equal(p.state().index,0);assert.equal(p.state().accepted,false);assert.deepEqual(run(p,10),[]);
 p.stop();assert.deepEqual(run(p,10),[]);assert.equal(p.state().active,false);
});
test('takeover waits at the current step rather than replaying old automatic cues',()=>{
 const p=P.create();p.start('watch');run(p,8.5);p.takeover();assert.equal(p.state().mode,'play');assert.equal(p.state().index,1);
 assert.equal(p.state().elapsed,0);assert.deepEqual(run(p,20),[]);assert.equal(p.input(0,'telunjuk').length,1);
});
test('stalled or invalid clocks never fast-forward choreography',()=>{
 const p=P.create();p.start('watch');assert.deepEqual(p.tick(NaN),[]);assert.deepEqual(p.tick(-1),[]);p.tick(60);assert.equal(p.state().elapsed,.25);
});
test('every play step can be completed or skipped and free mode emits nothing',()=>{
 const p=P.create();assert.deepEqual(p.input(0,'ok'),[]);assert.deepEqual(p.tick(.1),[]);p.start('play');
 for(let i=0;i<9;i++){if(i%2){p.skip();continue;}p.input(0,P.beats[i].gesture);run(p,8);}
 assert.equal(p.state().done,true);assert.deepEqual(p.skip(),[]);p.stop();assert.deepEqual(p.takeover(),[]);
});
