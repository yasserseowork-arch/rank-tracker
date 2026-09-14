
// content/fetch.js
// Developed by Ayub Ansary - SEO Specialist (https://ayubansary.com)
// Helping businesses grow beyond limitations
window.BT = window.BT || {};
(function(){
  const MAX_RETRIES = 2;
  function delay(ms, signal){
    return new Promise((res, rej)=>{
      const id = setTimeout(res, ms);
      if (signal){
        signal.addEventListener("abort", ()=>{ clearTimeout(id); rej(new DOMException("Aborted","AbortError")); }, {once:true});
      }
    });
  }
  async function fetchSERP(ctx, pageIndex, signal){
    const url = window.BT.params.makePageURL(ctx, pageIndex);
    let lastErr = null;
    for(let attempt=0; attempt<=MAX_RETRIES; attempt++){
      try{
        const res = await fetch(url, { credentials: "include", signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.text();
      }catch(e){
        lastErr = e;
        if (signal?.aborted) throw e;
        await delay(200*(attempt+1) + Math.random()*300, signal);
      }
    }
    throw lastErr || new Error("Fetch failed");
  }
  window.BT.fetcher = { delay, fetchSERP };
})();
