import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const M = createRequire(import.meta.url)('../js/motion-core.js');
test('travel reaches safe stage edges by wrist 20–80%, with neutral deadzone', () => {
  const b = M.bounds(900,450,150,20);
  assert.deepEqual(b,{min:-280,max:280});
  assert.equal(M.follow(.2,b),-280); assert.equal(M.follow(.8,b),280);
  assert.equal(M.follow(.505,b),0);
  assert.equal(M.follow(-2,b),-280); assert.equal(M.follow(4,b),280);
});
test('duet travel respects stage bounds from either initial slot', () => {
  const b = M.bounds(900,250,150,20);
  assert.deepEqual(b,{min:-80,max:480});
  assert.equal(250+M.follow(1,b)+150,880);
  assert.equal(250+M.follow(0,b)-150,20);
});
test('narrow stages never force a displaced resting position', () => {
  assert.deepEqual(M.bounds(240,120,150,20),{min:0,max:0});
});
test('analytic spring produces equal elapsed-time motion at 30/60/120 fps', () => {
  const states = [30,60,120].map(fps=>{ const s={x:0,v:0};for(let i=0;i<fps;i++) M.spring(s,280,1/fps,15);return s; });
  assert.ok(Math.abs(states[0].x-states[2].x)<1e-8);
  assert.ok(states.every(s=>s.x>279 && s.x<=280));
});
test('interrupted pose retains momentum, reverses and settles without a snap', () => {
  const s={x:0,v:0};for(let i=0;i<8;i++)M.spring(s,34,1/60,13);
  const old=s.x;M.spring(s,-30,1/60,13);assert.ok(Math.abs(s.x-old)<4);
  for(let i=0;i<120;i++)M.spring(s,-30,1/60,13);
  assert.ok(Math.abs(s.x+30)<.001); assert.ok(Math.abs(s.v)<.001);
});
test('story lanes retain a gap at desktop/tablet/mobile sizes, free duet keeps crossing',()=>{
 for(const width of [280,320,390,768,944,1366,1920]) {
  const envelope=Math.min(130,width*.19),centres=[width*.3,width*.7];
  const lanes=centres.map((c,i)=>M.laneBounds(M.bounds(width,c,envelope,20),width,c,envelope,i,16));
  assert.ok(centres[0]+lanes[0].max+envelope<=width/2-8+.001);
  assert.ok(centres[1]+lanes[1].min-envelope>=width/2+8-.001);
  for(const lane of lanes){assert.ok(lane.min<=lane.max);for(const x of [0,.2,.5,.8,1]){const v=M.follow(x,lane);assert.ok(v>=lane.min&&v<=lane.max);}}
  assert.deepEqual(M.laneBounds({min:-100,max:200},width,0,0,null),{min:-100,max:200});
 }
});
test('an impossible lane collapses to an available edge without inverted limits',()=>{
 const lane=M.laneBounds({min:0,max:0},200,100,150,0,16);assert.deepEqual(lane,{min:0,max:0});
});
