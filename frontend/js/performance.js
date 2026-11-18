/* Session coordinator. One clock; pending replies disappear on skip/repeat/exit. */
(function() {
  'use strict';
  const engine=WayangPerformance.create();
  let stage=null, saved=null, busy=false, session=false, manualPause=false, last=0, lastView='', wasPaused=false, cancelRequested=false;
  const $=id=>document.getElementById('performance-'+id);
  const active=()=>session;
  const paused=()=>session&&(busy||manualPause||document.hidden||!!document.querySelector('.app[inert]'));
  function lock(value) {
    ['kontrol-jumlah','kontrol-wayang-0','kontrol-wayang-1','dummy-pemain'].forEach(id=>{
      const node=document.getElementById(id);if(!node)return;
      node.inert=value;node.classList.toggle('performance-locked',value);
      if(value) node.setAttribute('aria-disabled','true');else node.removeAttribute('aria-disabled');
    });
  }
  function cues(items) {
    items.forEach(cue=>{
      if(cue.type==='perform') stage.perform(cue);
      if(cue.type==='beat') {stage.cancel();if(engine.state().mode==='play')stage.freeze();}
      if(cue.type==='complete') {stage.neutral();Teater.stopVoice();}
    });
    render();
  }
  function render() {
    if(!$('session'))return;
    const s=engine.state(), beat=s.beat;
    document.getElementById('performance').dataset.mode=busy?'loading':session?s.mode:'off';
    $('launch').hidden=session;$('session').hidden=!session;
    $('watch').disabled=$('play').disabled=!stage||busy;
    $('pause').disabled=$('takeover').disabled=busy||s.done;
    $('skip').disabled=busy||s.done||paused();
    const dummy=document.getElementById('dummy');
    if(dummy)dummy.inert=session&&(busy||paused()||s.mode!=='play');
    $('repeat').disabled=busy;
    $('exit').disabled=cancelRequested;
    $('takeover').hidden=s.mode!=='watch';
    $('pause').textContent=manualPause?'Lanjutkan lakon':'Jeda lakon';
    $('fill').style.width=(s.done?100:(s.index+(s.accepted?s.elapsed/s.duration:0))/WayangPerformance.beats.length*100)+'%';
    const practice=!!(document.body&&document.body.dataset.source==='dummy');
    const key=[busy,s.mode,s.index,s.accepted,manualPause,paused(),practice].join(':');
    if(key===lastView)return;lastView=key;
    $('act').textContent=busy?'MENYIAPKAN PANGGUNG':s.done?'SELESAI':beat.act+' · '+(s.index+1)+'/'+WayangPerformance.beats.length;
    $('step-title').textContent=busy?'Menyiapkan teman sepanggung…':s.done?'Sampai jumpa di lakon berikutnya.':beat.title;
    $('instruction').textContent=s.done?'Ulangi sebagai penonton atau pemain, atau kembali ke panggung bebas.':beat.text;
    $('icon').innerHTML=window.Glif?Glif.tangan(beat.gesture):'';
    $('status').textContent=cancelRequested?'Membatalkan lakon dan memulihkan panggung…':busy?'Tunggu sebentar.':s.done?'Pertemuan selesai.':paused()?'Lakon dijeda.':s.mode==='watch'?'Tonton gerak berbalas. Kamu bisa mengambil alih P1 kapan saja.':s.accepted?'Gestur diterima — beri waktu P2 untuk membalas.':'Giliran P1: '+Wayang.labelFor(beat.gesture)+(practice?'. Mode tombol aktif; tutup Latihan untuk memakai kamera.':'. Tunjukkan satu tangan di sisi mana pun dalam kamera.');
  }
  async function start(mode) {
    if(!stage||busy)return;
    busy=true;session=true;manualPause=false;cancelRequested=false;lastView='';
    if(!saved)saved=stage.snapshot();
    lock(true);render();
    try {
      await stage.prepare(mode);
      busy=false;if(cancelRequested){await exit();return;}
      last=performance.now();cues(engine.start(mode));if(stage.syncSource)stage.syncSource();
      $('pause').focus({preventScroll:true});document.querySelector('.stage-toolbar').scrollIntoView({block:'start'});
    } catch(error) {
      busy=false;await exit();
      $('intro').textContent=error.message+' Pilih Tonton contoh atau Mainkan lakon untuk mencoba lagi.';
    }
  }
  async function exit() {
    if(!session)return;
    if(busy) {cancelRequested=true;lastView='';render();return;}
    busy=true;stage.cancel();Teater.stopVoice();engine.stop();
    try {if(saved)await stage.restore(saved);}
    finally {saved=null;session=false;busy=false;manualPause=false;wasPaused=false;cancelRequested=false;if(stage.syncSource)stage.syncSource();lock(false);lastView='';render();$('watch').focus();}
  }
  function syncPause() {
    const value=paused();
    if(value&&!wasPaused&&stage){stage.cancel();Teater.stopVoice();}
    if(value!==wasPaused)last=performance.now();
    wasPaused=value;render();
  }
  window.Lakon={
    isActive:active,isPaused:paused,
    isPlaying:()=>session&&!busy&&engine.state().mode==='play',
    allowInput:(player,source)=>!session||source==='story'||(!paused()&&engine.state().mode==='play'&&player===0),
  };
  document.addEventListener('wayang:ready',event=>{stage=event.detail.stage;render();});
  document.addEventListener('wayang:gesture',event=>{
    const d=event.detail;if(!session||paused()||d.source==='story')return;
    cues(engine.input(d.player,d.gesture));
  });
  document.addEventListener('DOMContentLoaded',()=>{
    $('watch').addEventListener('click',()=>start('watch'));
    $('play').addEventListener('click',()=>start('play'));
    $('repeat').addEventListener('click',()=>start(engine.state().mode==='play'?'play':'watch'));
    $('exit').addEventListener('click',exit);
    $('pause').addEventListener('click',()=>{manualPause=!manualPause;syncPause();});
    $('takeover').addEventListener('click',()=>{stage.cancel();Teater.stopVoice();Dummy.setPemain(0);cues(engine.takeover());});
    $('skip').addEventListener('click',()=>{if(paused())return;stage.cancel();Teater.stopVoice();cues(engine.skip());});
    document.addEventListener('visibilitychange',syncPause);
    const app=document.querySelector('.app');
    new MutationObserver(syncPause).observe(app,{attributes:true,attributeFilter:['inert']});
    setInterval(()=>{
      const now=performance.now(),dt=last?(now-last)/1000:0;last=now;
      syncPause();
      if(session&&!busy)cues(engine.tick(dt,paused()));
    },100);
    render();
  });
})();
