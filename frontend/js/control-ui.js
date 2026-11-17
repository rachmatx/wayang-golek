/* Inline tuning leaves the stage live so a hand can be held while calibrating. */
(function() {
  'use strict';
  const $=id=>document.getElementById(id);
  const select=$('control-player');
  const hints={halus:'Gerakkan tangan lebih lebar untuk perpindahan yang tenang.',seimbang:'Gerakan tangan dan wayang seimbang.',responsif:'Gerakan tangan lebih kecil sudah menjangkau sisi panggung.'};
  let source=document.body.dataset.source;
  function put(node,text) { if(node.textContent!==text) node.textContent=text; }
  function render() {
    const duet=$('kelir').dataset.jumlah==='2';
    $('control-player-label').hidden=!duet;
    select.options[1].disabled=!duet;
    if(!duet) select.value='0';
    const player=Number(select.value);
    const ready=Kendali.ready(player);
    $('control-calibrate').disabled=!ready;
    $('control-calibrate').setAttribute('aria-label','Kalibrasi titik tengah pemain '+(player+1));
    put($('control-readiness'),ready?'Telunjuk siap. Tahan di posisi nyaman lalu kalibrasi.':source==='dummy'?'Pilih Telunjuk atau geser slider latihan terlebih dahulu.':'Tunjukkan telunjuk di kamera untuk mulai kalibrasi.');
    put($('control-centre-state'),Kendali.isCalibrated(player)?'Titik tengah tersimpan':'Titik tengah standar');
    const sensitivity=Kendali.sensitivity();
    document.querySelectorAll('[data-sensitivity]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.sensitivity===sensitivity)));
    put($('control-sensitivity-hint'),hints[sensitivity]);
  }
  select.addEventListener('change',()=>{put($('control-status'),'');render();});
  document.querySelectorAll('[data-sensitivity]').forEach(button=>button.addEventListener('click',()=>{
    Kendali.setSensitivity(button.dataset.sensitivity);render();
    put($('control-status'),'Kepekaan '+button.textContent.toLowerCase()+' tersimpan.');
  }));
  $('control-calibrate').addEventListener('click',()=>{
    const player=Number(select.value);
    const result=Kendali.calibrate(player);
    put($('control-status'),result.ok?'Titik tengah pemain '+(player+1)+' tersimpan.':result.reason==='edge'?'Tangan terlalu dekat tepi kamera. Geser sedikit ke tengah.':'Telunjuk belum terbaca. Tahan pose lalu coba lagi.');
    render();
  });
  $('control-reset').addEventListener('click',()=>{Kendali.reset();render();put($('control-status'),'Kedua titik tengah dan kepekaan kembali ke pengaturan awal.');});
  new MutationObserver(render).observe($('kelir'),{attributes:true,attributeFilter:['data-jumlah']});
  new MutationObserver(()=>{
    if(source!==document.body.dataset.source) {source=document.body.dataset.source;Kendali.clear(0);Kendali.clear(1);put($('control-status'),'');}
    render();
  }).observe(document.body,{attributes:true,attributeFilter:['data-source']});
  setInterval(()=>{if(!document.hidden)render();},500);
  document.addEventListener('visibilitychange',render);
  render();
})();
