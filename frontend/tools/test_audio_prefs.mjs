import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const P=createRequire(import.meta.url)('../js/audio-prefs.js');
const store = value => ({getItem:()=>value});
test('new visitors receive soft music and separate dialogue/effect levels',()=>{
 assert.deepEqual(P.read(store(null)),{dialog:.85,musik:.28,sfx:.7});
});
test('saved zero levels are retained; invalid fields fall back independently',()=>{
 assert.deepEqual(P.read(store('{"dialog":0,"musik":"0.2","sfx":2}')),{dialog:0,musik:.28,sfx:.7});
});
test('malformed, unavailable and blocked storage never blocks the stage',()=>{
 assert.deepEqual(P.read(store('broken')),P.defaults);
 assert.deepEqual(P.read(null),P.defaults);
 assert.deepEqual(P.read({getItem(){throw Error('blocked');}}),P.defaults);
 assert.doesNotThrow(()=>P.write(null,{dialog:.4}));
});
test('per-channel levels round-trip without changing old mute preferences',()=>{
 const data={'wayang-dialog':'mati','wayang-musik':'mati'};
 const storage={getItem:k=>data[k]??null,setItem:(k,v)=>{data[k]=v;}};
 P.write(storage,{dialog:.5,musik:0,sfx:.25});
 assert.deepEqual(P.read(storage),{dialog:.5,musik:0,sfx:.25});
 assert.equal(data['wayang-dialog'],'mati');assert.equal(data['wayang-musik'],'mati');
});
