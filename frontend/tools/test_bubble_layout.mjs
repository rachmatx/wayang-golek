import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const B=createRequire(import.meta.url)('../js/bubble-layout.js');
test('captions remain inside the stage at either edge, direction and responsive width',()=>{
 for(const width of [280,320,390,768,1366,1920])for(const x of [0,width*.3,width*.7,width])for(const facing of [-1,1]){
  const w=Math.min(230,(width-40)/2),r=B.place([{x,y:120,facing,width:w,height:75}],width,350)[0];
  assert.ok(r.x>=12&&r.x+r.width<=width-12);assert.ok(r.y>=27&&r.y+r.height<=308);assert.ok(r.tail>=16&&r.tail<=r.width-16);
 }
});
test('two captions do not overlap when partners face inward or cross positions',()=>{
 for(const width of [280,320,390,768,1366])for(const xs of [[.3,.7],[.7,.3],[.48,.52]]){
  const items=xs.map((x,i)=>({x:x*width,y:130,facing:i?-1:1,width:Math.min(230,(width-40)/2),height:80}));
  const r=B.place(items,width,350);assert.equal(B.overlaps(...r),false);
 }
});
test('travel and facing changes alter caption placement rather than pinning it to a stage corner',()=>{
 const one=B.place([{x:250,y:210,facing:1,width:180,height:70}],1000,600)[0];
 const moved=B.place([{x:450,y:210,facing:1,width:180,height:70}],1000,600)[0];
 const turned=B.place([{x:450,y:210,facing:-1,width:180,height:70}],1000,600)[0];
 assert.equal(moved.x-one.x,200);assert.ok(turned.x<moved.x);
});
