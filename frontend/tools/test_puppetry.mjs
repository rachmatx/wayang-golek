import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const P = createRequire(import.meta.url)('../js/puppetry-core.js');

test('greeting has preparation, asymmetric rod-arm accents and a held finish', () => {
  const start=P.sample('telapak_terbuka',0), prep=P.sample('telapak_terbuka',.15);
  const accent=P.sample('telapak_terbuka',.5), held=P.sample('telapak_terbuka',2);
  assert.deepEqual(start.angles,[0,0,0,0]);
  assert.ok(prep.angles[0]<0 && accent.angles[0]>30);
  assert.ok(accent.angles[1]<-50 && held.angles[1]<-40);
  assert.notEqual(Math.abs(accent.angles[0]),Math.abs(accent.angles[2]));
  assert.equal(held.lift,0);
});
test('held greeting accents are separated by readable pauses', () => {
  const a=P.sample('telapak_terbuka',3.6),b=P.sample('telapak_terbuka',4);
  assert.deepEqual(a,b);
  assert.notDeepEqual(P.sample('telapak_terbuka',2.55),a);
});
test('a bow has arm preparation, a sustained inclination and recovery', () => {
  for(const character of Object.keys(P.profiles)) {
    const tempo=P.profiles[character].tempo;
    assert.ok(P.sample('jempol',.3/tempo,{character}).angles[1]<-50);
    assert.equal(P.sample('jempol',.8/tempo,{character}).body,9);
    assert.deepEqual(P.sample('jempol',2.1/tempo,{character}).angles,[0,0,0,0]);
    assert.equal(P.sample('jempol',2.1/tempo,{character}).body,0);
  }
});
test('rod gait follows travel distance and stops when the puppet is stationary', () => {
  const a=P.sample('telunjuk',1,{speed:200,stride:Math.PI/2});
  const b=P.sample('telunjuk',10,{speed:200,stride:Math.PI/2});
  assert.deepEqual(a,b);
  assert.ok(a.lift>0 && a.angles[0]>0 && a.angles[2]<0);
  const stopped=P.sample('telunjuk',10,{speed:0,stride:Math.PI/2});
  assert.ok(stopped.angles.every(v=>v===0)); assert.equal(stopped.lift,0);
});
test('body lean respects travel direction after mirroring', () => {
  const right=P.sample('telunjuk',1,{speed:200,stride:0,facing:1});
  const mirrored=P.sample('telunjuk',1,{speed:200,stride:0,facing:-1});
  assert.equal(right.body,-mirrored.body);
});
test('characters have distinct phrasing and gait amplitude', () => {
  const styles=Object.keys(P.profiles).map(character=>P.sample('telunjuk',1,{character,speed:200,stride:Math.PI/2}));
  assert.ok(styles[1].lift<styles[0].lift && styles[0].lift<styles[2].lift);
  const greetings=Object.keys(P.profiles).map(character=>P.sample('telapak_terbuka',.45,{character}));
  assert.equal(new Set(greetings.map(p=>p.angles[0])).size,3);
});
test('reduced motion removes gait, lift and recurring wrist accents', () => {
  for(const pose of ['telunjuk','telapak_terbuka','dua_jari','jempol','ok']) {
    const a=P.sample(pose,.2,{reduced:true,speed:300,stride:1});
    const b=P.sample(pose,20,{reduced:true,speed:300,stride:3});
    assert.deepEqual(a,b); assert.equal(a.lift,0);
  }
});
test('all phrases remain finite and bounded through long holds and unknown characters', () => {
  for(const pose of ['netral','kepalan','telunjuk','telapak_terbuka','dua_jari','jempol','ok','unknown']) {
    for(let t=0;t<12;t+=.017) {
      const p=P.sample(pose,t,{character:'unknown',speed:9999,stride:t});
      assert.ok(p.angles.every(v=>Number.isFinite(v)&&Math.abs(v)<=180));
      assert.ok(Math.abs(p.body)<=10 && p.lift>=0 && p.lift<=12);
    }
  }
});
