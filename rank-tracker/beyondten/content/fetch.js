
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
  /** v1.21.35 (صفر console error): الـhandlers الداخلية (on*) في صفحة جوجل المجلوبة
   *  بتفجّر انتهاكات CSP حمرا — DOMParser بيرث سياسة الصفحة المضيفة (strict-dynamic
   *  + nonce)، وأي on*= بيتعمله بلوك والأCTION بتاعه null أصلًا. إحنا بندوّر على نصوص
   *  النتائج بس: بننزع السكربتات والمقابض قبل التسليم لأي parser — والتنظيف idempotent. */
  function cleanHTML(html){
    try{
      return String(html||"")
        .replace(/<script\b[\s\S]*?<\/script>/gi," ")
        .replace(/ on[a-z]{2,24}\s*=\s*"[^"]*"/gi," ")
        .replace(/ on[a-z]{2,24}\s*=\s*'[^']*'/gi," ")
        .replace(/ on[a-z]{2,24}\s*=\s*[^\s>]+/gi," ");
    }catch(_){ return html; }
  }
  async function fetchSERP(ctx, pageIndex, signal){
    const url = window.BT.params.makePageURL(ctx, pageIndex);
    let lastErr = null;
    for(let attempt=0; attempt<=MAX_RETRIES; attempt++){
      try{
        const res = await fetch(url, { credentials: "include", signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        // v1.2.0: جوجل بيرجع أحياناً 200 عادي بس بالجسم /sorry/ — نكشفها هنا
        // بدل ما تتحسب صفحة فاضية وتُحرق للأبد
        if (res.redirected && /\/sorry\//i.test(res.url)) throw new Error("sorry_page");
        if (text.length < 250000 && /unusual traffic/i.test(text) && !/id="search"/.test(text)) throw new Error("sorry_page");
        return cleanHTML(text);
      }catch(e){
        lastErr = e;
        if (signal?.aborted) throw e;
        if (String(e?.message || e).includes("sorry_page")) throw e; // المستدعي بيتعامل معها بهدوء
        await delay(1200*(attempt+1) + Math.random()*600, signal); // 1.2/2.4/3.6 ثانية بدل 200 مللي — أقل اشتباهاً
      }
    }
    throw lastErr || new Error("Fetch failed");
  }
  window.BT.fetcher = { delay, fetchSERP, cleanHTML };
})();
