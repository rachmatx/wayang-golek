/* Preview-only transport fixture. Never loaded by frontend/index.html. */
(function(){
 const fetchReal=window.fetch.bind(window);
 window.fetch=(url,options)=>String(url).includes('/api/health')?Promise.resolve(new Response(JSON.stringify({camera:true,camera_aktif:true,model_loaded:true,model:'mlp-fixture',fps:30,components:{mediapipe:true}}),{headers:{'Content-Type':'application/json'}})):fetchReal(url,options);
 let hands=[];
 const sockets=new Set();
 class FixtureSocket extends EventTarget {
  static OPEN=1;readyState=0;
  constructor(){super();sockets.add(this);setTimeout(()=>{this.readyState=1;this.dispatchEvent(new Event('open'));},10);}
  send(){} close(){this.readyState=3;sockets.delete(this);this.dispatchEvent(new Event('close'));}
 }
 window.WebSocket=FixtureSocket;
 window.addEventListener('message',event=>{if(event.source!==parent||event.data?.type!=='qa-camera')return;hands=event.data.hands;});
 setInterval(()=>{for(const socket of sockets)if(socket.readyState===1)socket.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({type:'prediction',camera:true,model_loaded:true,model:'mlp-fixture',fps:30,hands})}));},150);
})();
