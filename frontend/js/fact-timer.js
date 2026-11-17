/* A monotonic reading timer. Overlapping pause reasons cannot resume one another. */
(function(root) {
  'use strict';
  function create(interval, now) {
    const duration = interval || 30000;
    let remaining = duration;
    let last = now || 0;
    const reasons = new Set();
    function tick(time) {
      const elapsed = Math.max(0,time-last); last=time;
      if (reasons.size) return false;
      remaining -= elapsed;
      if (remaining > 0) return false;
      remaining = duration;
      return true; // Never skip through a backlog after a delayed browser tick.
    }
    return {
      tick,
      reset(time) { remaining=duration; last=time; },
      pause(reason,on,time) {
        if (!reasons.size) remaining=Math.max(1,remaining-Math.max(0,time-last));
        last=time;
        if(on) reasons.add(reason); else reasons.delete(reason);
      },
      paused() { return reasons.size > 0; },
      remaining() { return remaining; },
      duration,
    };
  }
  if(typeof module!=='undefined'&&module.exports) module.exports={create};
  else root.FactTimer={create};
})(typeof window==='undefined'?globalThis:window);
