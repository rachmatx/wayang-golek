/* Original mini-story. Active time only; reactions and watch-only accents are cancellable. */
(function(root) {
  'use strict';
  const beats=[
    {act:'Pertemuan',title:'Sapa teman sepanggung',gesture:'telapak_terbuka',reply:'jempol',line:'Mari meramaikan kelir!',answer:'Siap, aku menemanimu.',text:'Buka telapak tangan. Temanmu akan membalas dengan hormat.',extras:[[0,'dua_jari'],[1,'telapak_terbuka']]},
    {act:'Pertemuan',title:'Melangkah mendekat',gesture:'telunjuk',reply:'telunjuk',target:.34,other:.66,line:'Kemarilah, kanca.',answer:'Aku mendekat pelan.',text:'Tunjukkan telunjuk. Kedua tokoh mendekat, lalu memberi ruang.',extras:[[0,'kepalan'],[1,'dua_jari']]},
    {act:'Pertemuan',title:'Berhenti dan dengarkan',gesture:'kepalan',reply:'kepalan',line:'Sebentar, dengarkan.',answer:'Ya, aku menyimak.',text:'Kepalkan tangan untuk menghentikan langkah.',extras:[[0,'telapak_terbuka']]},
    {act:'Saling menyapa',title:'Sapaan berbalas',gesture:'telapak_terbuka',reply:'telapak_terbuka',line:'Senang bertemu denganmu.',answer:'Begitu juga denganku!',text:'Buka telapak. Beri jeda agar sapaanmu mendapat balasan.',extras:[[0,'jempol'],[1,'dua_jari']]},
    {act:'Saling menyapa',title:'Dua aksen, satu percakapan',gesture:'dua_jari',reply:'dua_jari',line:'Satu gerak, dua aksen!',answer:'Sekarang giliranku.',text:'Angkat dua jari. Perhatikan giliran gerak kedua tokoh.',extras:[[0,'telapak_terbuka'],[1,'jempol']]},
    {act:'Saling menyapa',title:'Tengok penonton',gesture:'ok',reply:'ok',line:'Tengok teman penonton.',answer:'Halo, semuanya!',text:'Bentuk tanda OK untuk berbalik bersama temanmu.',extras:[[0,'telapak_terbuka'],[1,'telapak_terbuka']]},
    {act:'Penutup',title:'Kembali memberi ruang',gesture:'telunjuk',reply:'telunjuk',target:.22,other:.78,line:'Kita beri ruang kembali.',answer:'Baik, aku ke sini.',text:'Tunjukkan telunjuk. Tokoh kembali ke sisi panggung.',extras:[[0,'dua_jari'],[1,'kepalan']]},
    {act:'Penutup',title:'Hormat bergantian',gesture:'jempol',reply:'jempol',line:'Terima kasih, kanca.',answer:'Sampai bertemu lagi.',text:'Angkat jempol. Hormat pertama disambut hormat kedua.',extras:[[0,'telapak_terbuka'],[1,'telapak_terbuka']]},
    {act:'Penutup',title:'Tutup pertemuan dengan tenang',gesture:'kepalan',reply:'kepalan',line:'Pertemuan kita selesai.',answer:'Cerita baru menanti!',text:'Kepalkan tangan. Biarkan kedua tokoh menutup pertemuan.',extras:[]},
  ];
  const readSeconds=text=>Math.max(2.2,text.trim().split(/\s+/).length/2.6+.6);
  // Nominal silent duration only. Actual turns also wait for media completion.
  beats.forEach(b=>{b.duration=readSeconds(b.line)+readSeconds(b.answer)+1.4;});
  const duration=beats.reduce((sum,b)=>sum+b.duration,0);
  function create() {
    let mode='off',index=0,elapsed=0,accepted=false,replied=false,extras=new Set(),turnElapsed=0,quiet=0;
    function state(){const b=beats[index];return {mode,index,elapsed,accepted,turn:!accepted?'waiting':replied?'reply':'lead',progress:!accepted?0:(replied ? .5 : 0)+Math.min(.45,turnElapsed/readSeconds(replied?b.answer:b.line)*.5),beat:b,duration:b.duration,done:mode==='done',active:mode==='watch'||mode==='play'};}
    function perform(player,manual){const b=beats[index];return {type:'perform',role:player?'reply':'lead',player,gesture:player?b.reply:b.gesture,target:player?b.other:b.target,face:index===6?(player?-1:1):undefined,manual:!!manual,text:player?b.answer:b.line};}
    function enter(){elapsed=turnElapsed=quiet=0;replied=false;extras=new Set();accepted=mode==='watch';return [{type:'beat',index}].concat(accepted?[perform(0)]:[]);}
    function start(nextMode){mode=nextMode==='play'?'play':'watch';index=0;return enter();}
    function advance(){if(++index>=beats.length){index=beats.length-1;mode='done';return [{type:'complete'}];}return enter();}
    function input(player,gesture){if(mode!=='play'||player!==0||accepted||gesture!==beats[index].gesture)return [];accepted=true;elapsed=turnElapsed=quiet=0;return [perform(0,true)];}
    function tick(dt,paused,dialogueBusy=false){
      if(paused||!state().active||!accepted||!Number.isFinite(dt)||dt<=0)return [];
      const step=Math.min(dt,.25);elapsed+=step;turnElapsed+=step;quiet=dialogueBusy?0:quiet+step;
      const b=beats[index],cues=[];
      if(!replied){
        if(!dialogueBusy&&turnElapsed>=readSeconds(b.line)&&quiet>=.45){replied=true;turnElapsed=quiet=0;cues.push(perform(1));}
        return cues;
      }
      // Silent accents are spaced within the reply, never emitted as a catch-up burst.
      if(mode==='watch'){
        const next=b.extras.findIndex((_,i)=>!extras.has(i));
        if(next>=0&&turnElapsed>=1+next*.8){const e=b.extras[next];extras.add(next);cues.push({type:'perform',role:'accent',player:e[0],gesture:e[1],silent:true});}
      }
      if(!dialogueBusy&&turnElapsed>=readSeconds(b.answer)+.5&&quiet>=.65)cues.push(...advance());
      return cues;
    }
    function resume(){if(!state().active||!accepted)return [];turnElapsed=quiet=0;return [{...perform(replied?1:0),type:'dialogue'}];}
    function takeover(){if(mode==='watch'){mode='play';return enter();}return [];}
    function skip(){return state().active?advance():[];}
    function stop(){mode='off';elapsed=turnElapsed=quiet=0;accepted=false;replied=false;extras.clear();}
    return {state,start,input,tick,resume,takeover,skip,stop};
  }
  const api={create,beats,duration};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.WayangPerformance=api;
})(typeof window==='undefined'?globalThis:window);
