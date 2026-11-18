/* Only runs while captions are visible. getScreenCTM includes travel, bow and facing. */
(function(){
  'use strict';
  let frame=null;
  function layout(){
    frame=null;
    const stage=document.getElementById('panggung');if(!stage)return;
    const rect=stage.getBoundingClientRect(),width=stage.clientWidth,height=stage.clientHeight;
    if(!width||!height)return;
    const captions=[...stage.querySelectorAll('.balon:not([hidden])')];
    const items=captions.map(node=>{
      const index=Number(node.dataset.player)||0,slot=document.getElementById('kelir-'+index),svg=slot&&slot.querySelector('svg'),body=slot&&slot.querySelector('.grup-wayang'),direction=slot&&slot.querySelector('.grup-arah');
      let x=width*(index?.72:.28),y=height*.3,facing=1;
      if(svg&&body){
        const ctm=body.getScreenCTM(),point=svg.createSVGPoint();
        point.x=Number(svg.dataset.bubbleX)||270;point.y=Number(svg.dataset.bubbleY)||140;
        if(ctm){const at=point.matrixTransform(ctm);x=(at.x-rect.left)*width/rect.width;y=(at.y-rect.top)*height/rect.height;}
        if(direction){const matrix=direction.getScreenCTM();if(matrix)facing=matrix.a<0?-1:1;}
      }
      return {x,y,facing,width:node.offsetWidth,height:node.offsetHeight};
    });
    WayangBubbleLayout.place(items,width,height).forEach((item,i)=>{
      const node=captions[i];node.style.left=item.x.toFixed(1)+'px';node.style.top=item.y.toFixed(1)+'px';
      node.style.setProperty('--bubble-tail',item.tail.toFixed(1)+'px');node.dataset.facing=item.facing<0?'kiri':'kanan';
    });
    if(captions.length&&!document.hidden)frame=requestAnimationFrame(layout);
  }
  function schedule(){if(frame===null)frame=requestAnimationFrame(layout);}
  document.addEventListener('wayang:bubble',schedule);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&frame!==null){cancelAnimationFrame(frame);frame=null;}else schedule();});
  window.addEventListener('resize',schedule);
})();
