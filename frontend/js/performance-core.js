/* Original mini-story. Active time only; reactions and watch-only accents are cancellable. */
(function(root) {
  'use strict';
  const beats=[
    {act:'Pertemuan',title:'Sapa teman sepanggung',gesture:'telapak_terbuka',reply:'jempol',duration:4,replyAt:.9,line:'Mari meramaikan kelir!',answer:'Siap, aku menemanimu.',text:'Buka telapak tangan. Temanmu akan membalas dengan hormat.',extras:[[2.1,0,'dua_jari'],[3.1,1,'telapak_terbuka']]},
    {act:'Pertemuan',title:'Melangkah mendekat',gesture:'telunjuk',reply:'telunjuk',target:.34,other:.66,duration:4.8,replyAt:.65,line:'Kemarilah, kanca.',answer:'Aku mendekat pelan.',text:'Tunjukkan telunjuk. Kedua tokoh mendekat, lalu memberi ruang.',extras:[[2.8,0,'kepalan'],[3.4,1,'dua_jari']]},
    {act:'Pertemuan',title:'Berhenti dan dengarkan',gesture:'kepalan',reply:'kepalan',duration:2.8,replyAt:.7,line:'Sebentar, dengarkan.',answer:'Ya, aku menyimak.',text:'Kepalkan tangan untuk menghentikan langkah.',extras:[[1.7,0,'telapak_terbuka']]},
    {act:'Saling menyapa',title:'Sapaan berbalas',gesture:'telapak_terbuka',reply:'telapak_terbuka',duration:4.2,replyAt:1,line:'Senang bertemu denganmu.',answer:'Begitu juga denganku!',text:'Buka telapak. Beri jeda agar sapaanmu mendapat balasan.',extras:[[2.5,0,'jempol'],[3.2,1,'dua_jari']]},
    {act:'Saling menyapa',title:'Dua aksen, satu percakapan',gesture:'dua_jari',reply:'dua_jari',duration:4,replyAt:.9,line:'Satu gerak, dua aksen!',answer:'Sekarang giliranku.',text:'Angkat dua jari. Perhatikan giliran gerak kedua tokoh.',extras:[[2.3,0,'telapak_terbuka'],[3,1,'jempol']]},
    {act:'Saling menyapa',title:'Tengok penonton',gesture:'ok',reply:'ok',duration:3.4,replyAt:.8,line:'Tengok teman penonton.',answer:'Halo, semuanya!',text:'Bentuk tanda OK untuk berbalik bersama temanmu.',extras:[[1.9,0,'telapak_terbuka'],[2.5,1,'telapak_terbuka']]},
    {act:'Penutup',title:'Kembali memberi ruang',gesture:'telunjuk',reply:'telunjuk',target:.22,other:.78,duration:4.8,replyAt:.65,line:'Kita beri ruang kembali.',answer:'Baik, aku ke sini.',text:'Tunjukkan telunjuk. Tokoh kembali ke sisi panggung.',extras:[[3,0,'dua_jari'],[3.6,1,'kepalan']]},
    {act:'Penutup',title:'Hormat bergantian',gesture:'jempol',reply:'jempol',duration:4.2,replyAt:1.1,line:'Terima kasih, kanca.',answer:'Sampai bertemu lagi.',text:'Angkat jempol. Hormat pertama disambut hormat kedua.',extras:[[2.8,0,'telapak_terbuka'],[3.3,1,'telapak_terbuka']]},
    {act:'Penutup',title:'Tutup pertemuan dengan tenang',gesture:'kepalan',reply:'kepalan',duration:2.8,replyAt:.8,line:'Pertemuan kita selesai.',answer:'Cerita baru menanti!',text:'Kepalkan tangan. Biarkan kedua tokoh menutup pertemuan.',extras:[]},
  ];
  const duration=beats.reduce((sum,b)=>sum+b.duration,0);
  function create() {
    let mode='off',index=0,elapsed=0,accepted=false,replied=false,extras=new Set();
    function state(){return {mode,index,elapsed,accepted,beat:beats[index],duration:beats[index].duration,done:mode==='done',active:mode==='watch'||mode==='play'};}
    function perform(player,manual){const b=beats[index];return {type:'perform',role:player?'reply':'lead',player,gesture:player?b.reply:b.gesture,target:player?b.other:b.target,face:index===6?(player?-1:1):undefined,manual:!!manual,text:player?b.answer:b.line};}
    function enter(){elapsed=0;replied=false;extras=new Set();accepted=mode==='watch';return [{type:'beat',index}].concat(accepted?[perform(0)]:[]);}
    function start(nextMode){mode=nextMode==='play'?'play':'watch';index=0;return enter();}
    function advance(){if(++index>=beats.length){index=beats.length-1;mode='done';return [{type:'complete'}];}return enter();}
    function input(player,gesture){if(mode!=='play'||player!==0||accepted||gesture!==beats[index].gesture)return [];accepted=true;elapsed=0;return [perform(0,true)];}
    function tick(dt,paused){
      if(paused||!state().active||!accepted||!Number.isFinite(dt)||dt<=0)return [];
      elapsed+=Math.min(dt,.25);
      const b=beats[index],cues=[];
      if(!replied&&elapsed>=b.replyAt){replied=true;cues.push(perform(1));}
      if(mode==='watch')b.extras.forEach((e,i)=>{if(elapsed>=e[0]&&!extras.has(i)){extras.add(i);cues.push({type:'perform',role:'accent',player:e[1],gesture:e[2],silent:true});}});
      if(elapsed>=b.duration-1e-9)cues.push(...advance());
      return cues;
    }
    function takeover(){if(mode==='watch'){mode='play';return enter();}return [];}
    function skip(){return state().active?advance():[];}
    function stop(){mode='off';elapsed=0;accepted=false;replied=false;extras.clear();}
    return {state,start,input,tick,takeover,skip,stop};
  }
  const api={create,beats,duration};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.WayangPerformance=api;
})(typeof window==='undefined'?globalThis:window);
