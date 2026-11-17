import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const req=createRequire(import.meta.url),C=req('../js/control-core.js'),M=req('../js/motion-core.js');
const range={min:-280,max:280};
function setup(saved){let time=0;const map={'wayang-controls-v1':saved};const storage={getItem:k=>map[k]??null,setItem:(k,v)=>map[k]=v};return {c:C.create(storage,()=>time),storage,at:t=>time=t};}
test('defaults remain usable when preferences are absent or malformed',()=>{
 for(const s of [null,'bad','{"centres":[0,2],"sensitivity":"__proto__"}']){const {c}=setup(s);assert.deepEqual(c.settings(0),{centre:.5,span:.3});}
 assert.doesNotThrow(()=>C.create(null).reset());
});
test('calibration is independent per player and maps the captured point to neutral',()=>{
 const {c}=setup();c.record(0,.3);assert.equal(c.calibrate(0).ok,true);c.record(1,.75);assert.equal(c.calibrate(1).ok,true);
 assert.equal(M.follow(.3,range,c.settings(0)),0);assert.equal(M.follow(.75,range,c.settings(1)),0);assert.equal(c.settings(0).centre,.3);
});
test('missing, stale, and edge samples cannot overwrite a good calibration',()=>{
 const {c,at}=setup();assert.deepEqual(c.calibrate(0),{ok:false,reason:'missing'});
 c.record(0,.6);assert.equal(c.calibrate(0).ok,true);at(2000);assert.equal(c.calibrate(0).ok,false);
 c.record(0,.99);assert.deepEqual(c.calibrate(0),{ok:false,reason:'edge'});assert.equal(c.settings(0).centre,.6);
 c.clear(0);assert.equal(c.ready(0),false);
});
test('a held practice slider remains available for calibration until cleared',()=>{
 const {c,at}=setup();c.record(0,.65,'practice');at(60000);assert.equal(c.ready(0),true);assert.equal(c.calibrate(0).ok,true);
 c.clear(0);assert.equal(c.ready(0),false);
});
test('responsiveness changes required hand travel while retaining safe stage limits',()=>{
 const {c}=setup();const values=[];for(const p of ['halus','seimbang','responsif']){c.setSensitivity(p);values.push(M.follow(.65,range,c.settings(0)));assert.equal(M.follow(1,range,c.settings(0)),280);assert.equal(M.follow(0,range,c.settings(0)),-280);}
 assert.ok(values[0]<values[1]&&values[1]<values[2]);
});
test('off-centre calibration still reaches both edges and has a stable deadzone',()=>{
 const {c}=setup();c.record(0,.85);c.calibrate(0);const s=c.settings(0);
 assert.equal(M.follow(.85,range,s),0);assert.equal(M.follow(.851,range,s),0);assert.equal(M.follow(.97,range,s),280);assert.ok(Math.abs(M.follow(.55,range,s)+280)<1e-8);
});
test('profiles survive reload and reset restores both players and sensitivity',()=>{
 const {c,storage}=setup();c.record(1,.7);c.calibrate(1);c.setSensitivity('responsif');const loaded=C.create(storage,()=>0);
 assert.equal(loaded.settings(1).centre,.7);assert.equal(loaded.isCalibrated(1),true);assert.equal(loaded.settings(1).span,.2);
 loaded.reset();assert.equal(loaded.settings(0).centre,.5);assert.equal(loaded.settings(1).centre,.5);assert.equal(loaded.sensitivity(),'seimbang');assert.equal(loaded.isCalibrated(1),false);
});
