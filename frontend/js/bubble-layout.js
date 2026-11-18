/* Stage-local placement, independent of viewport size or current actor direction. */
(function(root){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(Math.max(a,b),v));
  const overlaps=(a,b)=>a.x<b.x+b.width+8&&a.x+a.width+8>b.x&&a.y<b.y+b.height+8&&a.y+a.height+8>b.y;
  function place(items,width,height){
    const margin=12,top=27,bottom=height-42;
    const result=items.map(item=>{
      const w=Math.min(item.width,width-2*margin),h=item.height;
      const x=clamp(item.facing<0?item.x-w-14:item.x+14,margin,width-w-margin);
      return {...item,x,y:clamp(item.y-h-17,top,bottom-h),width:w,height:h};
    });
    if(result.length===2&&overlaps(result[0],result[1])){
      const order=[0,1].sort((a,b)=>items[a].x-items[b].x);
      result[order[0]].x=margin;
      result[order[1]].x=width-margin-result[order[1]].width;
      // Narrow layouts use bubbles capped to half-stage width in CSS.
      if(overlaps(result[0],result[1]))result[order[1]].y=clamp(result[order[0]].y+result[order[0]].height+10,top,bottom-result[order[1]].height);
    }
    return result.map((r,i)=>({...r,tail:clamp(items[i].x-r.x,16,r.width-16),facing:items[i].facing}));
  }
  const api={place,overlaps};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.WayangBubbleLayout=api;
})(typeof window==='undefined'?globalThis:window);
