import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {create}=createRequire(import.meta.url)('../js/fact-timer.js');
test('fact advances at 30 seconds, never earlier',()=>{
 const t=create(30000,0);assert.equal(t.tick(29999),false);assert.equal(t.tick(30000),true);assert.equal(t.remaining(),30000);
});
test('overlapping hover, modal and hidden pauses must all clear before resuming',()=>{
 const t=create(30000,0);t.tick(10000);t.pause('hover',true,10000);t.pause('modal',true,12000);
 t.pause('hover',false,18000);assert.equal(t.tick(80000),false);assert.equal(t.remaining(),20000);
 t.pause('hidden',true,80000);t.pause('modal',false,90000);assert.equal(t.tick(100000),false);
 t.pause('hidden',false,100000);assert.equal(t.tick(119999),false);assert.equal(t.tick(120000),true);
});
test('manual navigation grants the new fact a complete reading interval',()=>{
 const t=create(30000,0);t.tick(29000);t.reset(29000);assert.equal(t.tick(30000),false);assert.equal(t.tick(59000),true);
});
test('long event-loop delays advance once, without skipping a chain of facts',()=>{
 const t=create(30000,0);assert.equal(t.tick(300000),true);assert.equal(t.tick(300001),false);assert.equal(t.remaining(),29999);
});
test('offscreen time does not consume a paused reading interval',()=>{
 const t=create(30000,0);t.pause('offscreen',true,0);assert.equal(t.tick(600000),false);
 t.pause('offscreen',false,600000);assert.equal(t.tick(629999),false);assert.equal(t.tick(630000),true);
});
