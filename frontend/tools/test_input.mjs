import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const req=createRequire(import.meta.url),I=req('../js/input-core.js');
const base={source:'live',connection:'connected',intent:true,camera:true,modelLoaded:true,tracker:true,lastPredictionAt:100,hands:[]};
test('stage presence is aggregated and emits only on empty/nonempty transitions',()=>{
 const p=I.presence();assert.equal(p.update(2),'wayang:hand');assert.equal(p.update(1),null);assert.equal(p.update(0),'wayang:nohand');assert.equal(p.update(0),null);assert.equal(p.update(1),'wayang:hand');
 p.reset();assert.equal(p.update(0),'wayang:nohand');
});
test('feedback separates disabled, unavailable, connecting and working cameras',()=>{
 for(const [extra,expected] of [[{intent:false},'off'],[{camera:false},'unavailable'],[{camera:null},'checking'],[{connection:'disconnected'},'disconnected'],[{},'no_hand']])assert.equal(I.status({...base,...extra},100).state,expected);
});
test('practice remains usable despite backend/camera/model failures',()=>{
 const v=I.status({...base,source:'dummy',connection:'disconnected',camera:false,modelLoaded:false},10000);assert.equal(v.state,'practice');
});
test('model and tracker failures differ from a pose that has not stabilized',()=>{
 assert.equal(I.status({...base,modelLoaded:false},100).state,'model');assert.equal(I.status({...base,tracker:false},100).state,'tracker');
 assert.equal(I.status({...base,hands:[{state:'unknown'}]},100).state,'holding');
});
test('both players remain legible when one hand is absent or uncertain',()=>{
 const label=x=>x==='telunjuk'?'Telunjuk':x;
 const accepted={state:'ok',gesture:'telunjuk'};
 assert.equal(I.status({...base,label,hands:[accepted,null]},100).hint,'P1: Telunjuk · P2: belum terlihat');
 const v=I.status({...base,label,hands:[{state:'unknown'},accepted]},100);assert.equal(v.state,'accepted');assert.equal(v.hint,'P1: tahan pose · P2: Telunjuk');
});
test('stale predictions never keep reporting a gesture as accepted',()=>{
 const data={...base,hands:[{state:'ok',gesture:'ok'}]};assert.equal(I.status(data,3100).state,'accepted');assert.equal(I.status(data,3101).state,'stale');
 assert.equal(I.status({...data,lastPredictionAt:null},100).state,'stale');
});
