import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const P=createRequire(import.meta.url)('../js/performance-core.js');
const run=(core,seconds,paused=false)=>{const cues=[];for(let n=0;n<seconds*100;n++)cues.push(...core.tick(.01,paused));return cues;};
test('watch has three acts, all six gestures, readable silent pacing and one response per beat',()=>{
 const p=P.create(),cues=p.start('watch');cues.push(...run(p,70));
 assert.equal(p.state().done,true);assert.equal(cues.filter(c=>c.type==='perform'&&c.role==='lead').length,9);
 assert.equal(cues.filter(c=>c.type==='perform'&&c.role==='reply').length,9);
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
 const p=P.create();p.start('watch');run(p,.5);const elapsed=p.state().elapsed;
 assert.deepEqual(run(p,60,true),[]);assert.equal(p.state().elapsed,elapsed);
 const cues=run(p,2);assert.equal(cues.filter(c=>c.player===1).length,1);
});
test('skip, repeat and exit discard pending replies',()=>{
 const p=P.create();p.start('watch');run(p,1);p.skip();
 assert.equal(p.state().index,1);assert.deepEqual(run(p,.5),[]);
 p.start('play');assert.equal(p.state().index,0);assert.equal(p.state().accepted,false);assert.deepEqual(run(p,10),[]);
 p.stop();assert.deepEqual(run(p,10),[]);assert.equal(p.state().active,false);
});
test('takeover waits at the current step rather than replaying old automatic cues',()=>{
 const p=P.create();p.start('watch');run(p,6);p.takeover();assert.equal(p.state().mode,'play');assert.equal(p.state().index,1);
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

test('watch adds varied accents while guided play preserves manual ownership',()=>{
 const watch=P.create();watch.start('watch');const w=run(watch,70);assert.ok(w.filter(c=>c.role==='accent').length>=12);assert.ok(P.duration>45);
 const play=P.create();play.start('play');play.input(0,P.beats[0].gesture);assert.equal(run(play,4).filter(c=>c.role==='accent').length,0);
});
test('takeover and skipping discard remaining watch accents',()=>{
 const p=P.create();p.start('watch');run(p,1.2);p.takeover();assert.deepEqual(run(p,3),[]);
 p.input(0,'telapak_terbuka');assert.equal(run(p,4).filter(c=>c.role==='accent').length,0);
});

test('slow speech holds both turn boundaries without accumulating skipped beats',()=>{
 const p=P.create();p.start('watch');const cues=[];
 for(let i=0;i<200;i++)cues.push(...p.tick(.1,false,true));
 assert.equal(p.state().index,0);assert.equal(cues.length,0);
 for(let i=0;i<7;i++)cues.push(...p.tick(.1,false,false));
 assert.equal(cues.filter(c=>c.role==='reply').length,1);
 for(let i=0;i<200;i++)p.tick(.1,false,true);
 assert.equal(p.state().index,0,'reply must finish before next step');
 const next=[];for(let i=0;i<7;i++)next.push(...p.tick(.1,false,false));
 assert.equal(p.state().index,1);assert.equal(next.filter(c=>c.role==='lead').length,1);
});
test('silent and unavailable voices still leave enough time to read both lines',()=>{
 const p=P.create();p.start('watch');assert.equal(run(p,2).some(c=>c.role==='reply'),false);
 assert.equal(run(p,.3).filter(c=>c.role==='reply').length,1);assert.equal(p.state().index,0);
 run(p,2);assert.equal(p.state().index,0);run(p,1);assert.equal(p.state().index,1);
});
test('resume repeats the interrupted line only, without replaying movement or old turns',()=>{
 const p=P.create();p.start('watch');run(p,1);
 assert.equal(p.resume()[0].type,'dialogue');assert.equal(p.resume()[0].player,0);
 run(p,2.3);assert.equal(p.resume()[0].player,1);
 assert.equal(run(p,2).some(c=>c.type==='beat'),false);p.stop();assert.deepEqual(p.resume(),[]);
});
