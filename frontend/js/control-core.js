/* Per-player neutral points and shared sensitivity. Never stores images or landmarks. */
(function(root) {
  'use strict';
  const key='wayang-controls-v1';
  const spans={halus:.42,seimbang:.3,responsif:.2};
  function validCentre(value) { return typeof value==='number'&&Number.isFinite(value)&&value>=.1&&value<=.9; }
  function create(storage,clock) {
    const now=clock||(()=>performance.now());
    let saved;
    try { saved=JSON.parse(storage.getItem(key)); } catch(_) { /* Defaults work without storage. */ }
    let sensitivity=saved&&Object.hasOwn(spans,saved.sensitivity)?saved.sensitivity:'seimbang';
    const centres=[0,1].map(i=>saved&&Array.isArray(saved.centres)&&validCentre(saved.centres[i])?saved.centres[i]:.5);
    const calibrated=[0,1].map(i=>Boolean(saved&&Array.isArray(saved.calibrated)&&saved.calibrated[i]===true));
    const samples=[null,null];
    function persist() { try { storage.setItem(key,JSON.stringify({sensitivity,centres,calibrated})); } catch(_) {} }
    return {
      settings(index) { return {centre:centres[index===1?1:0],span:spans[sensitivity]}; },
      sensitivity() { return sensitivity; },
      isCalibrated(index) { return calibrated[index]===true; },
      setSensitivity(value) { if(!Object.hasOwn(spans,value)) return false; sensitivity=value; persist(); return true; },
      record(index,value,source) { if(index!==0&&index!==1) return; if(Number.isFinite(value)&&value>=0&&value<=1) samples[index]={value,time:now(),source:source==='practice'?'practice':'live'}; },
      clear(index) { samples[index]=null; },
      ready(index) { const s=samples[index]; return Boolean(s&&(s.source==='practice'||now()-s.time<=1500)); },
      calibrate(index) {
        const s=samples[index];
        if(!s||(s.source!=='practice'&&now()-s.time>1500)) return {ok:false,reason:'missing'};
        if(!validCentre(s.value)) return {ok:false,reason:'edge'};
        centres[index]=s.value; calibrated[index]=true; persist(); return {ok:true};
      },
      reset() { centres[0]=centres[1]=.5; calibrated[0]=calibrated[1]=false; samples[0]=samples[1]=null; sensitivity='seimbang'; persist(); },
    };
  }
  const api={create,spans};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  else { let storage; try { storage=root.localStorage; } catch(_) {} root.Kendali=create(storage); }
})(typeof window==='undefined'?globalThis:window);
