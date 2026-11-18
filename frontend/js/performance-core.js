/* Original, digital mini-story. Deterministic clock; no timers or DOM here. */
(function (root) {
  'use strict';
  const beats = [
    {act:'Pertemuan', title:'Sapa teman sepanggung', gesture:'telapak_terbuka', reply:'jempol', text:'Buka telapak tangan. Temanmu akan membalas dengan hormat.'},
    {act:'Pertemuan', title:'Melangkah mendekat', gesture:'telunjuk', reply:'telunjuk', target:.34, other:.66, text:'Tunjukkan telunjuk. Kedua tokoh mendekat, lalu memberi ruang.'},
    {act:'Pertemuan', title:'Berhenti dan dengarkan', gesture:'kepalan', reply:'kepalan', text:'Kepalkan tangan untuk menghentikan langkah.'},
    {act:'Saling menyapa', title:'Sapaan berbalas', gesture:'telapak_terbuka', reply:'telapak_terbuka', text:'Buka telapak. Beri jeda agar sapaanmu mendapat balasan.'},
    {act:'Saling menyapa', title:'Dua aksen, satu percakapan', gesture:'dua_jari', reply:'dua_jari', text:'Angkat dua jari. Perhatikan giliran gerak kedua tokoh.'},
    {act:'Saling menyapa', title:'Tengok penonton', gesture:'ok', reply:'ok', text:'Bentuk tanda OK untuk berbalik bersama temanmu.'},
    {act:'Penutup', title:'Kembali memberi ruang', gesture:'telunjuk', reply:'telunjuk', target:.22, other:.78, text:'Tunjukkan telunjuk. Tokoh kembali ke sisi panggung.'},
    {act:'Penutup', title:'Hormat bergantian', gesture:'jempol', reply:'jempol', text:'Angkat jempol. Hormat pertama disambut hormat kedua.'},
    {act:'Penutup', title:'Tutup pertemuan dengan tenang', gesture:'kepalan', reply:'kepalan', text:'Kepalkan tangan. Biarkan kedua tokoh menutup pertemuan.'},
  ];
  const duration=8, replyAt=1.6;
  function create() {
    let mode='off', index=0, elapsed=0, accepted=false, replied=false;
    function state() { return {mode,index,elapsed,accepted,beat:beats[index],done:mode==='done',active:mode==='watch'||mode==='play'}; }
    function perform(player,manual) {
      const beat=beats[index];
      return {type:'perform',player,gesture:player?beat.reply:beat.gesture,
        target:player?beat.other:beat.target, face:index===6?(player?-1:1):undefined, manual:!!manual};
    }
    function enter() {
      elapsed=0; replied=false; accepted=mode==='watch';
      return [{type:'beat',index}].concat(accepted?[perform(0)]:[]);
    }
    function start(nextMode) { mode=nextMode==='play'?'play':'watch';index=0;return enter(); }
    function advance() {
      if (++index>=beats.length) {index=beats.length-1;mode='done';return [{type:'complete'}];}
      return enter();
    }
    function input(player,gesture) {
      if (mode!=='play'||player!==0||accepted||gesture!==beats[index].gesture) return [];
      accepted=true;elapsed=0;return [perform(0,true)];
    }
    function tick(dt,paused) {
      if (paused||!state().active||!accepted||!Number.isFinite(dt)||dt<=0) return [];
      elapsed+=Math.min(dt,.25); // Never replay a backlog after a stalled/backgrounded tab.
      const cues=[];
      if (!replied&&elapsed>=replyAt) {replied=true;cues.push(perform(1));}
      if (elapsed>=duration-1e-9) cues.push(...advance());
      return cues;
    }
    function takeover() {if(mode==='watch') {mode='play';return enter();}return [];}
    function skip() {return state().active?advance():[];}
    function stop() {mode='off';elapsed=0;accepted=false;replied=false;}
    return {state,start,input,tick,takeover,skip,stop};
  }
  const api={create,beats,duration,replyAt};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.WayangPerformance=api;
})(typeof window==='undefined'?globalThis:window);
