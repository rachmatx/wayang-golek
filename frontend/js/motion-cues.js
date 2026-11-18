/* Accent markers share the puppet's active animation clock, never wall timers.
 * Values are digital staging choices, not a transcription of traditional karawitan.
 */
(function(root) {
  'use strict';
  const markers={
    telapak_terbuka:[[.16,'prepare','saron',.16],[.52,'accent','saron',.58],[1.08,'answer','peking',.24]],
    dua_jari:[[.38,'accent','peking',.52],[.72,'answer','saron',.38]],
    jempol:[[.28,'prepare','saron',.16],[.68,'accent','saron',.55],[1.38,'release','keprak',.16]],
    ok:[[.12,'prepare','whoosh',.26],[.30,'accent','saron',.44]],
    kepalan:[[.18,'accent','kendang',.55]],
  };
  function create() {
    let pose='netral', fired=new Set(), lastStride=null, distance=0;
    function reset(name) {pose=name;fired=new Set();lastStride=null;distance=0;}
    function sample(elapsed, options) {
      const opts=options||{},tempo=Number.isFinite(opts.tempo)?opts.tempo:1;
      const time=Math.max(0,elapsed)*tempo, cues=[];
      const list=markers[pose]||[];
      if(opts.reduced) {
        const accent=list.find(m=>m[1]==='accent');
        if(accent&&elapsed>=.08&&!fired.has('reduced')) {
          fired.add('reduced');cues.push({phase:'accent',sound:accent[2],gain:accent[3]*.75});
        }
        return cues;
      }
      list.forEach((marker,i)=>{
        if(time>=marker[0]&&!fired.has(i)) {
          fired.add(i);cues.push({phase:marker[1],sound:marker[2],gain:marker[3]});
        }
      });
      if(pose==='telunjuk'&&Number.isFinite(opts.stride)) {
        // Distance-driven steps: a stationary pointing hand makes no repeated sound.
        if(lastStride!==null)distance+=Math.abs(opts.stride-lastStride);
        lastStride=opts.stride;
        if(distance>=Math.PI) {
          distance%=Math.PI;
          if(Math.abs(opts.speed||0)>15)cues.push({phase:'step',sound:'keprak',gain:.2});
        }
      }
      return cues;
    }
    return {reset,sample};
  }
  const api={create,markers};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.WayangMotionCues=api;
})(typeof window==='undefined'?globalThis:window);
