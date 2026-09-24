/**
 * serp.js — Content Script لصفحة نتائج جوجل — الإصدار 1.4
 *
 * الإصدار 1.9 — الاستيل القديم الموثوق + قاعدة الـ20 ثانية «الواعية بالتقدّم»:
 *  ─ نزول تدريجي بشري + مسح حي بعد كل دفعة نتائج.
 *  ─ أول ما الموقع يظهر بين النتائج → ترتيب فوري وانتقال فوري للكلمة التالية.
 *  ─ العدّاد بيقولف (نتائج جديدة بتنزل)؟ كمّل لحد سقف scanHardCapMs — المراكز
 *    الغويط (#30-#100) ما تتقطعش في النص. العدّاد واقع 20 ثانية؟ غير موجود (-) وننتقل.
 *  ─ AI Overview: توسيع بالنقر المزدوج + مطابقة بالاسم العربي.
 *  ─ صفحات الخطأ → ريفرش تلقائي، و403/404 → تاب جديد. نص كابتشا → إعلان دوري.
 */
(function () {
  'use strict';
  const C = globalThis.SRT_C;
  const D = globalThis.SRT;
  if (!C || !D) { return; }

  const href = location.href;
  if (!D.url.isSearch(href) || D.url.isSorry(href)) { return; }
  if (globalThis.__SRT_SERP_BOOTED__) { return; }
  globalThis.__SRT_SERP_BOOTED__ = true;

  const keyword = D.url.query('q');
  const expectedNum = parseInt(D.url.query('num'), 10) || 100;

  D.msg.startHeartbeat('serp');

  const live = { parsedSent: false, errorKind: null, captchaText: false, results: 0, reloads: 0, early: false };

  const session = {
    get(key) { try { return sessionStorage.getItem(key); } catch (_) { return null; } },
    set(key, val) { try { sessionStorage.setItem(key, val); } catch (_) {} }
  };
  const RELOAD_KEY = 'srt-reloads:' + keyword;
  live.reloads = parseInt(session.get(RELOAD_KEY) || '0', 10) || 0;

  function bodySample() {
    try { return (document.body && document.body.innerText ? document.body.innerText : '').slice(0, 4000); } catch (_) { return ''; }
  }

  /* --------------------------- صفحات الخطأ → ريفرش --------------------------- */
  async function handleBadPage(cfg) {
    const kind = D.errorsig.detectError(document.title, bodySample());
    live.errorKind = kind;
    if (!kind || kind === 'captcha-text') { return false; }
    if (kind === 'http-error') {
      // 403/404/429/5xx: لا ريفرش في نفس التبويب — المحرك يفتح تبويباً جديداً
      await D.msg.send(C.MSG.SERP_ERROR, { kind: kind, keyword: keyword, needsNewTab: true });
      return true;
    }
    const max = cfg.errorReloadMax == null ? 2 : cfg.errorReloadMax;
    if (live.reloads < max) {
      live.reloads += 1;
      session.set(RELOAD_KEY, String(live.reloads));
      await D.msg.send(C.MSG.SERP_ERROR, { kind: kind, keyword: keyword, reload: true, attempt: live.reloads });
      await D.humanSleep(2200, 900);
      location.reload();
      return true;
    }
    await D.msg.send(C.MSG.SERP_ERROR, { kind: kind, keyword: keyword, reload: false, attempt: live.reloads });
    return false;
  }

  function startCaptchaTextAnnouncer() {
    live.captchaText = true;
    const announce = () => D.msg.send(C.MSG.CAPTCHA_PRESENT, {
      pageUrl: href, textBased: true, hasRecaptchaIframe: !!D.qs('iframe[src*="recaptcha"]')
    });
    announce();
    setInterval(announce, 2500);
  }

  /* ------------------------------ صندوق البحث ------------------------------ */
  function typeIntoSearchBox(text) {
    const box = D.first(C.SEL.search.box);
    if (!box) { return false; }
    try { box.focus({ preventScroll: true }); } catch (_) {}
    const proto = box.tagName === 'TEXTAREA'
      ? Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')
      : Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    if (proto && proto.set) { proto.set.call(box, text); } else { box.value = text; }
    box.dispatchEvent(new Event('input', { bubbles: true }));
    box.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function submitSearchForm() {
    const box = D.first(C.SEL.search.box);
    const form = box ? (box.closest('form') || D.first(C.SEL.search.form)) : D.first(C.SEL.search.form);
    if (form && typeof form.requestSubmit === 'function') { form.requestSubmit(); return true; }
    if (form && typeof form.submit === 'function') { form.submit(); return true; }
    if (box) {
      box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
      return true;
    }
    return false;
  }

  D.msg.on(C.MSG.SERP_CMD_SEARCH, async (m) => {
    const kw = String(m.keyword || '').trim();
    if (!kw) { return { ok: false, reason: 'empty-keyword' }; }
    if (!typeIntoSearchBox(kw)) { return { ok: false, reason: 'no-box' }; }
    await D.humanSleep(260, 130);
    const ok = submitSearchForm();
    return { ok: ok, reason: ok ? null : 'no-form' };
  });

  D.msg.on(C.MSG.SERP_CMD_STATE, async () => ({
    parsedSent: live.parsedSent,
    errorKind: live.errorKind,
    captchaText: live.captchaText,
    results: live.results,
    reloads: live.reloads,
    early: live.early,
    href: location.href
  }));

  /* --------------- القارئ المقاوم لتغييرات جوجل (درس Serp Counter) --------------- */
  const BAD_HREF = /google\.com\/(search|url|maps|imgres)|googleads\.g\.doubleclick\.net|\/aclk\?|\/services\//;

  function extractFrom(root, isLive) {
    const scope = root || document;
    let anchors;
    try {
      anchors = Array.prototype.slice.call(scope.querySelectorAll('#search a, #rso a, main a'));
    } catch (_) { anchors = []; }
    if (!anchors.length) {
      try { anchors = Array.prototype.slice.call(scope.querySelectorAll('a[href^="http"]')); } catch (_) { anchors = []; }
    }
    const seen = new Set();
    const items = [];
    for (const a of anchors) {
      const h3 = a.querySelector('h3');
      if (!h3) { continue; }
      const block0 = a.closest('div.g') || a.closest('div[data-hveid]') || a.closest('.yuRUbf') || a.parentElement;
      const infoX = citeInfo(block0 || a, a);
      const url = infoX.url;
      if (!url) { continue; }
      if (seen.has(url)) { continue; }
      const hostX = D.url.hostOf(url);
      if (/google\.(com|sa|com\.sa)$|googleads\.g\.doubleclick\.net/.test(hostX)) { continue; }
      if (a.closest('#tads, #tadsb, #bads, .ads-visurl, [data-text-ad], #topads')) { continue; }
      if (a.closest(C.SEL.serp.paa.join(','))) { continue; }
      if (isLive) {
        const rect = h3.getBoundingClientRect();
        if (!rect || rect.height < 8 || rect.width < 8) { continue; }
      }
      seen.add(url);
      const block = block0;
      const sn = block ? D.first(C.SEL.serp.snippet, block) : null;
      items.push({
        url: url,
        host: D.url.hostOf(url),
        title: D.textOf(h3),
        snippet: sn ? D.textOf(sn) : '',
        // نص البلوك كامل (سطر اسم الموقع المعروض/المسار/براند جوه كرت المنتج) —
        // محرك المطابقة بيركّب item.text أصلاً؛ كده «الاسم باين قدامك» = لقاوة
        text: blockText(block || a)
      });
    }
    return items;
  }



  /**
   * جوجل بيختبر روابط توجيه مشفرة (/goto?url=CAES…) — الدومين الحقيقي
   * بيقعد في سطر cite المعروض. بنقرأ المعروض الأول وبعدين الـ href المباشر.
   */
  function citeInfo(block, a) {
    let display = '';
    try {
      const cite = block.querySelector('cite');
      if (cite) { display = (cite.textContent || '').replace(/\s+/g, ' ').trim(); }
    } catch (_) {}
    let url = '';
    try {
      const cite = block.querySelector('cite');
      if (cite) {
        const txt = cite.textContent || '';
        let m = txt.match(/https?:\/\/[^\s\u203a>"]+/i);
        if (m) { url = m[0]; }
        else {
          m = txt.match(/(?:[a-z0-9\u0660-\u0669-]+\.)+[a-z]{2,}(?:\/[^\s\u203a]*)?/i);
          if (m) { url = 'https://' + m[0]; }
        }
      }
    } catch (_) {}
    if (!url && a && a.href && /^https?:/i.test(a.href) && !/\/(goto|url)\?/i.test(a.href)) { url = a.href; }
    // صفحة ثابتة (مجلوبة خلفيًا) بلا cite؟ الرابط الحقيقي مستور في /url?q= — نفكّه
    if (!url && a && a.href && /\/goto\/?\?|\/url\/?\?/i.test(a.href)) {
      try {
        const uu = new URL(a.href);
        const q = uu.searchParams.get('q') || uu.searchParams.get('url');
        if (q && /^https?:/i.test(q)) { url = q; }
      } catch (_) {}
    }
    if (!display) { display = url; }
    return { url: url, display: display };
  }

  /** قراءة الرقم الأخضر اللي بتحقنه إضافة Serp Counter جنب النتيجة */
  function readCounterPos(node) {
    let el = node;
    for (let up = 0; up < 4 && el; up++) {
      if (el.querySelector) {
        const cc = el.querySelector('.countme-serp-counter');
        if (cc) {
          const mm = (cc.textContent || '').match(/\d+/);
          if (mm) { return parseInt(mm[0], 10); }
        }
      }
      el = el.parentElement;
    }
    return null;
  }

  function blockText(blk) {
    try { return (blk.innerText || '').replace(/\s+/g, ' ').slice(0, 600); } catch (_) { return ''; }
  }

  /* ------- عدّاد Serp Counter المدمج: #search .yuRUbf بترتيب الظاهر ------- */
  function counterItems() {
    const blocks = D.qsa('#search .yuRUbf');
    const items = [];
    const seen = new Set();
    for (const b of blocks) {
      const a = b.querySelector('a');
      const h3 = a ? a.querySelector('h3') : null;
      if (!a || !h3) { continue; }
      let hh = 0;
      try { hh = parseFloat(getComputedStyle(h3).height) || 0; } catch (_) { hh = h3.getBoundingClientRect().height; }
      if (!hh || hh < 20) { continue; } // نتيجة مخفية/مطوية كما في عدّاد Serp Counter
      const blk0 = a.closest('div.g') || a.closest('div[data-hveid]') || b;
      const info0 = citeInfo(blk0, a);
      const url = info0.url;
      if (!url || seen.has(url)) { continue; }
      const host0 = D.url.hostOf(url);
      if (/google\.(com|sa|com\.sa)$|googleads\.g\.doubleclick\.net/.test(host0)) { continue; }
      if (a.closest('#tads, #tadsb, #bads, .ads-visurl, [data-text-ad], #topads')) { continue; }
      if (a.closest(C.SEL.serp.paa.join(','))) { continue; }
      seen.add(url);
      const blk = blk0;
      const sn = D.first(C.SEL.serp.snippet, blk);
      items.push({
        url: url,
        click: a.href || url,
        display: info0.display,
        host: D.url.hostOf(url),
        title: D.textOf(h3),
        snippet: sn ? D.textOf(sn) : '',
        text: blockText(blk),
        counterPos: readCounterPos(b)
      });
    }
    return items;
  }

  function collect() {
    let items = counterItems();           // الأولوية لترقيم Serp Counter
    if (!items.length) { items = extractFrom(document, true); }
    live.results = items.length;
    const adsCount = D.qsa('#tads .g, #tadsb .g, [data-text-ad]').length;
    return { items: items, adsCount: adsCount };
  }

  /* ---------------- AI Overview: كشف قوي + توسيع ثم قراءة ---------------- */
  /*
   * درس الشكاوى المتكررة: بلوك «نبذة الذكاء الاصطناعي» بيتم رسمه بعد أول
   * نتيجة، والمحددات الثابتة بتاع جوجل بتتبدل كل فترة. الخطة:
   *  1) محددات معروفة  2) عناوين نصية عربي/إنجليزي (زي ما بتظهر قدام المستخدم)
   *  3) أصناف معروفة حديثة  4) انتظار قصير للظهور — والطريقة الآمنة دي
   * بتفضل محمية بنفس الحرس: أي جذر بيحتوي النتائج العضوية نفسها مرفوض.
   */
  const AI_HEADS = [
    'نبذة الذكاء الاصطناعي', 'نبذة باستخدام الذكاء الاصطناعي',
    'لمحة الذكاء الاصطناعي', 'لمحة عن الذكاء الاصطناعي',
    'نظرة عامة على الذكاء الاصطناعي', 'وضع الذكاء الاصطناعي',
    'ملخص الذكاء الاصطناعي', 'AI Overview', 'AI overviews',
    'AI summary', 'About this result', 'لمحة عن هذه النتيجة'
  ];
  let aiExpanded = false;
  let aiRootEl = null;

  function hasOrganicInside(e) {
    return !!(e && e.querySelector && e.querySelector('#rso, #res, #center_col, #search'));
  }

  /** حجم البلوك الجاهز: فيه لينكات استشهاد أو نص ملخص حقيقي */
  function aiBoxReady(e) {
    if (!e) { return false; }
    try {
      if (e.querySelectorAll('a[href^="http"]').length >= 1) { return true; }
      const t = e.innerText || '';
      return t.length >= 160;
    } catch (_) { return false; }
  }

  /** من أي مرساة (عنوان/لينك) نطلع فوق لأقرب حاوية آمنة فيها محتوى */
  function safeBoxUp(el, hops) {
    let cur = el && el.parentElement ? el.parentElement : el;
    let last = null;
    for (let i = 0; cur && i < (hops || 12); i++) {
      if (hasOrganicInside(cur)) { break; }
      if (aiBoxReady(cur)) { last = cur; }
      cur = cur.parentElement;
    }
    return last;
  }

  /** البحث عن مرساة نصية: عناصر صغيرة فقط (عشان ما يطابقش الحاويات العملاقة) */
  function headAnchor() {
    const nrm = (D.match && D.match.normalizeArabic) ? D.match.normalizeArabic : (s) => String(s || '').toLowerCase();
    const needles = AI_HEADS.map((h) => nrm(h));
    const nodes = document.querySelectorAll('h1, h2, h3, h4, span, div, a');
    for (const node of nodes) {
      if (node.childElementCount > 2) { continue; }
      const own = nrm((node.textContent || '').trim());
      if (!own || own.length > 64) { continue; }
      for (const nd of needles) {
        if (nd && own.indexOf(nd) !== -1) { return node; }
      }
    }
    return null;
  }

  /** جذر بلوك الذكاء الاصطناعي — طبقات كشف متتالية كلها بحرس مضاد للتلوث العضوي */
  let aiMissTs = 0; // كاش سلبي: الماسح الكامل متيتكررش كل 250ms عبثًا
  function aiRoot() {
    if (aiRootEl && document.contains(aiRootEl) && !hasOrganicInside(aiRootEl)) { return aiRootEl; }
    aiRootEl = null;
    if (Date.now() - aiMissTs < 1200) { return null; }
    // 1) المحددات المعروفة
    aiMissTs = 0;
    const sels = (C.SEL.serp.ai || []);
    for (const sel of sels) {
      let e = null;
      try { e = document.querySelector(sel); } catch (_) { e = null; }
      if (e && !hasOrganicInside(e)) { aiRootEl = e; return e; }
    }
    // 2) مرساة نصية → صندوق آمن فوقها
    const head = headAnchor();
    if (head) {
      const box = safeBoxUp(head.closest('div, section'), 12) || safeBoxUp(head, 12);
      if (box) { aiRootEl = box; return box; }
    }
    aiMissTs = Date.now();
    return null;
  }

  /** بوادر البلوك في الـHTML قبل الترطيب: placeholder الـasync بتاع جوجل للـAI */
  function aiHint() {
    try {
      if (document.querySelector('[id*="ai-overview" i], [id*="aiOverview"]')) { return true; }
    } catch (_) {}
    return false;
  }

  /** استجابة فورية من الكاش/الـDOM، ولو فيه بوادر نفضل مستنيين ظهوره لحد timeoutMs */
  async function waitForAiRoot(timeoutMs) {
    const immediate = aiRoot();
    if (immediate && aiBoxReady(immediate)) { return immediate; }
    if (!immediate && !aiHint()) { return null; } // مفيش AI خالص — من غير ما نعلّش أي كلمة بثواني
    try {
      return await D.waitFor(() => {
        const r = aiRoot();
        return (r && aiBoxReady(r)) ? r : null;
      }, { timeoutMs: timeoutMs || 0, intervalMs: 400, desc: 'ai-block' });
    } catch (_) { return immediate || null; }
  }

  /** زرار «عرض المزيد / عرض الكل / View all sources» بأي صيغة كانت */
  function expandBtn(root) {
    const re = /عرض\s+المزيد|عرض\s+الكل|عرض\s+كل\s+المصادر|show\s+more|show\s+all|view\s+all\s+sources|view\s+sources|المصادر|sources/i;
    const cands = D.qsa('button, [role="button"], div[jsaction], a', root);
    for (const b of cands) {
      const t = (b.textContent || '').trim();
      const al = b.getAttribute ? (b.getAttribute('aria-label') || '') : '';
      if (!t && !al) { continue; }
      if (re.test(t) || re.test(al)) { return b; }
    }
    return null;
  }

  async function expandAi() {
    if (aiExpanded) { return; }
    const root = aiRoot();
    if (!root) { return; }
    aiExpanded = true;
    for (let round = 0; round < 2; round++) {
      const btn = expandBtn(root);
      if (!btn) { break; }
      D.click(btn, 'ai-expand');
      await D.humanSleep(1100, 400);
    }
  }

  /** فك تحويلات جوجل (google.com/url?q=...) — بنقارن المصدر الحقيقي مش عنوان التحويل */
  function unwrapRedirect(h) {
    try {
      const u = new URL(h);
      if (/google\./.test(u.hostname || '')) {
        const q = u.searchParams.get('q') || u.searchParams.get('url');
        if (q && /^https?:/i.test(q)) { return q; }
      }
    } catch (_) {}
    return h;
  }

  /** قبل أي حكم: نستنى بلوك AI يترسم (async) → نوسّع «عرض المزيد/الكل» → نعيد القراءة.
   *  كده الاستشهادات المخفية أو اللي لسه مجتش متتفوتش في أي مسار (حتى الخروج المبكر). */
  async function finalizeAi(aiSnap) {
    const root = await waitForAiRoot(5000);
    if (!root) {
      if (aiHint()) {
        D.msg.send(C.MSG.LOG, { level: 'info', scope: 'serp', text: 'ℹ️ الصفحة فيها بوادر بلوك AI لكنه مترسّمش جوه الـDOM — شكّل السجل ده لو تكرر، معناه جوجل غيّرت الشكل' });
      }
      return aiSnap;
    }
    await expandAi();
    return collectAi();
  }

  function collectAi() {
    const root = aiRoot();
    if (!root) { return { items: [], text: '' }; }
    const scopes = [root];
    // بعد «عرض الكل» قائمة المصادر بتتفتح في dialog خارج البلوك — بنلمّ كمان اللي فيه
    if (aiExpanded) {
      for (const dlg of D.qsa('jsdialog, [role="dialog"]')) { scopes.push(dlg); }
    }
    const seen = new Set();
    const items = [];
    for (const scope of scopes) {
      for (const a of D.qsa('a[href^="http"]', scope)) {
        if (!a.href || a.href.indexOf('http') !== 0) { continue; }
        const real = unwrapRedirect(a.href);
        if (seen.has(real)) { continue; }
        seen.add(real);
        items.push({
          url: real,
          host: D.url.hostOf(real),
          title: D.textOf(a),
          snippet: D.textOf(a.parentElement || a)
        });
      }
    }
    let text = '';
    try {
      text = (root.innerText || '').slice(0, 8000);
      // وكمان: أسماء المواقع جوه dialog المصادر جزء من الحكم الصارم
      for (let i = 1; i < scopes.length; i++) {
        try { const dt = scopes[i].innerText || ''; if (dt) { text += '\n' + dt.slice(0, 4000); } } catch (_) {}
      }
    } catch (_) {}
    return { items: items, text: text };
  }

  function hasTarget(cfg) {
    return !!(cfg && ((cfg.storeDomain || '').trim() || (cfg.storeName || '').trim() || (cfg.storeNameEn || '').trim()));
  }

  function quickFind(items, aiItems, cfg) {
    if (!hasTarget(cfg) || !D.match) { return null; }
    const organic = D.match.matchItems(items, cfg);
    if (organic.found) { return { where: 'organic', match: organic }; }
    const ai = D.match.matchItems(aiItems || [], cfg);
    if (ai.found) { return { where: 'ai', match: ai }; }
    return null;
  }

  /* --------- جلب باقي الدفعات خلفيةً (بدون تنقّل) عندما لا تكفي الصفحة --------- */
  async function selfFetchMore(cfg, baseItems, aiItems) {
    const merged = baseItems.slice();
    const seen = new Set(merged.map((i) => i.url));
    let start = Math.ceil(merged.length / 10) * 10;
    const maxBatches = cfg.selfFetchMaxBatches || 9;
    let attempts = 0;

    // دفعة فاشلة كانت بتمحو تغطية المراكز الغويط بصمت (شكوى: «موقعي في #20 واتسجل مش
    // موجود») — بقى فيه إعادة محاولة عاقلة للدفعة نفسها، وتوقيت ذاتي-التصحيح
    async function grab(s) {
      const u = new URL(href);
      u.searchParams.set('start', String(s));
      u.searchParams.set('num', '20'); // للصفحات المجلوبة بس — تاب المستخدم يفضل بلا بصمة
      const resp0 = await fetch(u.toString(), { credentials: 'include', redirect: 'follow' });
      if (!resp0.ok) { return { err: 'http-' + resp0.status }; }
      const html = await resp0.text();
      if (/\/sorry\/|unusual traffic|حركة مرور غير عادية/i.test(html)) {
        D.msg.send(C.MSG.SERP_FETCH_BLOCKED, { reason: 'captcha', pageUrl: u.toString() });
        return { blocked: true };
      }
      return { doc: new DOMParser().parseFromString(html, 'text/html') };
    }

    for (let batch = 0; batch < maxBatches && merged.length < expectedNum; batch++) {
      let res = null;
      try { res = await grab(start); } catch (_) { res = { err: 'net' }; }
      if (res.blocked) { attempts++; break; }
      if (res.err) {
        await D.sleep(2500); // سكتة ثم فرصة تانية لنفس الدفعة — من غير ما نفقد الباقي
        try { res = await grab(start); } catch (_) { res = { err: 'net' }; }
        if (res.err) {
          attempts++;
          if (attempts >= 2) { break; }
          start += 10;
          continue;
        }
      }
      const more = extractFrom(res.doc, false);
      let added = 0;
      for (const item of more) {
        if (!seen.has(item.url)) { seen.add(item.url); merged.push(item); added++; }
      }
      if (!more.length || !added) {
        attempts++;
        if (attempts >= 2) { break; } // صفحتين ورا بعض فاضيتين = جوجل قافل الجلب، كفاية أدب
        start += 10;
        await D.humanSleep(900, 400);
        continue;
      }
      attempts = 0;
      start = Math.ceil(merged.length / 10) * 10; // تصحيح ذاتي لو الصفحة جت 20 أو 10
      const hit = quickFind(merged, aiItems, cfg);
      if (hit) {
        live.early = true;
        return { items: merged, aiItems: aiItems, early: true, hit: hit, selfFetched: true };
      }
      // v1.20.1: البين-دفعات 0.9 ثانية كانت عدو Requests — بنزول بشري هادي
      await D.humanSleep(2400, 1600);
    }
    if (merged.length > baseItems.length || attempts) {
      D.msg.send(C.MSG.LOG, { level: attempts ? 'warn' : 'info', scope: 'serp',
        text: `🛰 الجلب الخلفي: التغطية بقت ${merged.length} نتيجة (من ${expectedNum})${attempts ? ' — جوجل قفل الجلب بعد ' + attempts + ' محاولات، وقَفنا بأدب' : ''}` });
    }
    return { items: merged, aiItems: aiItems, early: false, selfFetched: true };
  }

  /* ------ انتظار الدفعات: مسح من فوق + Ctrl+F مبكر — بدون أي سكرول ------ */

  /** هل نص الدومين/الاسم موجود على الشاشة دلوقتي؟ (Ctrl+F بشري) */
  function bodyHasTarget(cfg) {
    const root = D.qs('#search') || D.qs('#rso') || document.body;
    let txt = '';
    try { txt = (root.innerText || '').toLowerCase(); } catch (_) { txt = ''; }
    if (!txt) { return false; }
    const d = String(cfg.storeDomain || '').trim().toLowerCase();
    if (d && txt.includes(d)) { return true; }
    // الدومين مضبوط ولسه مش على الشاشة؟ الاسم لوحده ما يفتحش البوابة — نفس سياسة المحرك
    if (d && String(cfg.matchMode || 'both') !== 'name') { return false; }
    const names = (D.match && D.match.storeNames) ? D.match.storeNames(cfg) : [String(cfg.storeName || '').trim()].filter(Boolean);
    if (names.length && D.match && D.match.normalizeArabic) {
      const hay = D.match.normalizeArabic(txt);
      for (const n of names) {
        const needle = D.match.normalizeArabic(n);
        if (needle && needle.length >= 3 && hay.includes(needle)) { return true; }
      }
    }
    return false;
  }

  /** ترتيب البلوك اللي جواه نص الدومين/الاسم مباشرة + عنصره لو جاهز */
  function positionByText(cfg, items) {
    const blocks = D.qsa('#search .yuRUbf');
    const d = String(cfg.storeDomain || '').trim().toLowerCase();
    const nameGate = !d || String(cfg.matchMode || 'both') === 'name';
    const namesList = nameGate ? ((D.match && D.match.storeNames) ? D.match.storeNames(cfg) : [String(cfg.storeName || '')].filter(Boolean)) : [];
    const nNorms = (D.match && D.match.normalizeArabic) ? namesList.map((x) => D.match.normalizeArabic(x)).filter((x) => x.length >= 3) : [];
    for (let i = 0; i < blocks.length; i++) {
      let t = '';
      try { t = (blocks[i].innerText || '').toLowerCase(); } catch (_) { t = ''; }
      const hitD = d && t.includes(d);
      const hitN = !!nNorms.length && nNorms.some((nn) => D.match.normalizeArabic(t).includes(nn));
      if (hitD || hitN) {
        const cPos = readCounterPos(blocks[i]);
        const matched = (items || []).find((it) => it.counterPos === (cPos || i + 1)) || (items || [])[i] || null;
        return { position: cPos || i + 1, matched: matched };
      }
    }
    return null;
  }

  /** مطابقة فورية بمستويين: collect أولاً ثم فحص نصي مباشر على الشاشة */
  function immediateFind(cfg, snap, aiItems) {
    const h = quickFind(snap.items, aiItems || [], cfg);
    if (h) { return h; }
    if (bodyHasTarget(cfg)) {
      const pos = positionByText(cfg, snap.items);
      if (pos) {
        D.msg.send(C.MSG.LOG, { level: 'info', scope: 'serp', text: '🔎 مطابقة نصية مباشرة من الشاشة (الـ cite/البلوك لسه بيرسم) — وقفنا فوراً' });
        return { where: 'organic', match: pos };
      }
    }
    return null;
  }


  /* -------- قفل السكرول: الصفحة تفضل فوق من لحظة فتحها لحد ما نقرأ ونكتب --------
     ممنوع أي غوص (منّا أو من أداة تحميل الـ100 نتيجة) إلا لو قررنا نحن النزول
     لأن الموقع مش على الشاشة. بعد القراءة: قفل تاني نهائي. */
  let scrollLocked = true;
  function lockScroll() { try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch (_) {} }
  try {
    window.addEventListener('scroll', () => { if (scrollLocked) { lockScroll(); } }, { passive: true });
    setInterval(() => { if (scrollLocked) { lockScroll(); } }, 250);
  } catch (_) {}
  function relock() { scrollLocked = true; lockScroll(); }
  function releaseScroll() { scrollLocked = false; }

  function logger_serp(text) {
    try { D.msg.send(C.MSG.LOG, { level: 'info', scope: 'serp', text: text }); } catch (_) {}
  }

  function logEarly(hit, items) {
    relock();
    const pos = hit && hit.match && hit.match.position ? hit.match.position : (hit && hit.match ? 'AI' : '?');
    D.msg.send(C.MSG.LOG, {
      level: 'info', scope: 'serp',
      text: `⛏ الموقع اتلقى عند #${pos} — وقفنا المسح فوراً (${items.length} نتيجة مقروءة) وانتقلنا للكلمة التالية`
    });
  }

  async function waitForResults(cfg) {
    const maxWait = cfg.maxWaitResultsMs || 20000;
    const batchSettle = cfg.batchSettleMs || 5000;
    const rescan = cfg.rescanMs || 1800;
    const settleMs = cfg.settleMs || 1800;

    let early = null;

    // 1) من أول نتيجة بتظهر: فحص مطابقة كل 250ms — الموقع فوق؟ خروج فوري
    //    بدون أي توسيع AI أو تمرير قبل كده (التوسيع بيتأجل لوقت الحكم بعدم وجوده)
    let aiSeenLogged = false;
    const firstHit = await D.waitFor(() => {
      const snap = collect();
      if (!snap.items.length) { return D.first(C.SEL.serp.noResults); }
      const ai = collectAi();
      const h = immediateFind(cfg, snap, ai.items);
      // ضربة «AI» لوحدها مش خروج — ترتيبك العضوي ممكن يكون تحت في #20+؛ بنعلّم وبس
      if (h && h.where === 'organic') { early = { items: snap.items, ai: ai, hit: h }; }
      else if (h && !aiSeenLogged) { aiSeenLogged = true; D.msg.send(C.MSG.LOG, { level: 'info', scope: 'serp', text: '🤖 الموقع باين في AI Overview — كمّل نزول بحثاً عن الترتيب العضوي' }); }
      return true;
    }, { timeoutMs: Math.min(maxWait, 20000), intervalMs: 250, desc: 'first-result' });

    if (early) {
      logEarly(early.hit, early.items);
      const aiE = await finalizeAi(early.ai);
      return { items: early.items, aiItems: aiE.items, aiText: aiE.text, adsCount: 0, early: true, hit: early.hit };
    }
    if (firstHit && firstHit !== true && firstHit.nodeType) {
      return { early: false, settled: true, noResults: true, items: [], aiItems: [], aiText: '' };
    }

    const started = Date.now();
    let lastCount = -1;
    let lastChange = Date.now();
    let settled = false;
    let gaveCompanionExtra = false;
    let companionSeen = false;
    let aiText = '';

    function companionActive() {
      return /Loaded \d+|Scroll for more|Show 100 results|Done \d+ results/i.test(bodySample());
    }

    // 2) لسه مش موجود: نزول تدريجي + فحص بعد كل دفعة — أول ظهور = وقف فوري
    for (;;) {
      const snapshot = collect();
      const ai = collectAi();
      aiText = ai.text || aiText;
      const count = snapshot.items.length;
      if (companionActive()) { companionSeen = true; }

      const hit = immediateFind(cfg, snapshot, ai.items);
      if (hit && hit.where === 'organic') {
        logEarly(hit, snapshot.items);
        const aiF = await finalizeAi(ai);
        return { items: snapshot.items, aiItems: aiF.items, aiText: aiF.text || aiText, adsCount: snapshot.adsCount, early: true, hit: hit };
      }
      if (hit && !aiSeenLogged) {
        // AI بس؟ علّم وكَمّل — الخروج البدري هنا بيضيّع ترتيب المراكز البعيدة
        aiSeenLogged = true;
        await logger_serp('🤖 الموقع باين في AI Overview — كمّل نزول بحثاً عن الترتيب العضوي');
      }
      // الهدف مش على الشاشة خالص؟ فقط حينها نفك القفل وننزل ندور
      const now = Date.now();
      if (count !== lastCount) {
        lastCount = count;
        lastChange = now;
      } else if (count > 0 && now - lastChange >= batchSettle) {
        if (!gaveCompanionExtra && companionSeen) {
          gaveCompanionExtra = true;
          lastChange = now;
          await D.sleep(rescan);
          continue;
        }
        settled = true;
        break;
      }
      if (count >= expectedNum && now - lastChange >= settleMs) {
        settled = true;
        break;
      }
      // قاعدة الـ20 ثانية «واعية بالتقدّم»: العدّاد واقف؟ خلاص نكتفي بالمقروء.
      // لسه النتيجة الجديدة بتيجي واحدة ورا التانية؟ كمّل نزول لحد السقف
      // (scanHardCapMs — 60 ثانية افتراضياً) — عشان المراكز الغويط (#30-#100) متضيعش.
      if (count === lastCount && now - started >= maxWait) { break; }
      if (now - started >= Math.max(cfg.scanHardCapMs || 60000, maxWait)) { break; }

      releaseScroll();
      const nearBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 400;
      if (!nearBottom) {
        window.scrollBy({ top: 600 + Math.round(Math.random() * 500), behavior: 'auto' });
        window.dispatchEvent(new Event('scroll'));
      } else {
        window.dispatchEvent(new Event('scroll'));
      }
      await D.sleep(rescan + Math.round(Math.random() * 500));
    }

    // 3) حكم عدم الوجود: دلوقتي بس — نستنى البلوك يترسم لو بطيء، نوسّع، ونفحص آخر مرة
    let items = collect().items;
    const aiF = await finalizeAi({ items: [], text: '' });
    let aiItems = aiF.items;
    aiText = aiF.text || aiText;
    // حكم النهاية بطبقتين: بلوكات محللة + مطابقة نصية مباشرة من الشاشة (Ctrl+F ستايل)
    const lastHit = immediateFind(cfg, { items: items }, aiItems);
    if (lastHit) {
      logEarly(lastHit, items);
      return { items: items, aiItems: aiItems, aiText: aiText, adsCount: 0, early: true, hit: lastHit };
    }

    if (cfg.selfFetchMore !== false && items.length < expectedNum) {
      // حتى لو الـ companion كان شغال: لو وقفنا عند نص الطريق، الدفعات الجاية تتجيب
      // من ورا الظهر (dedupe بالـ URL مضمون — مفيش تكرار بيغيّر الترتيب)
      const sf = await selfFetchMore(cfg, items, aiItems);
      items = sf.items;
      aiItems = sf.aiItems || aiItems;
      if (sf.early) {
        return { items: items, aiItems: aiItems, aiText: aiText, adsCount: 0, early: true, hit: sf.hit, selfFetched: true };
      }
    }

    // شبكة الأمان الأخيرة: الجلب خلّص والاسم/الدومين باين على الشاشة بس البلوك ما اتحللش؟
    // فحص مباشر على النص الحي + عدّ الترتيب من البلوكات — قبل حكم «غير موجود» بخطوة
    const lateHit = immediateFind(cfg, { items: items }, aiItems);
    if (lateHit) {
      logEarly(lateHit, items);
      return { items: items, aiItems: aiItems, aiText: aiText, adsCount: 0, early: true, hit: lateHit, rescued: true };
    }

    return { items: items, aiItems: aiItems, aiText: aiText, adsCount: 0, early: false, settled: settled };
  }

  /* --------------------------------- الإقلاع --------------------------------- */
  async function main() {
    const cfgRes = await D.msg.send(C.MSG.GET_CONFIG);
    const cfg = cfgRes && cfgRes.config ? cfgRes.config : {};

    if (await handleBadPage(cfg)) { return; }

    const kind = D.errorsig.detectError(document.title, bodySample());
    if (kind === 'captcha-text') {
      startCaptchaTextAnnouncer();
      return;
    }

    D.msg.send(C.MSG.SERP_STARTED, { keyword: keyword, serpUrl: href, expectedNum: expectedNum });

    const wait = await waitForResults(cfg);
    const payload = {
      keyword: keyword,
      serpUrl: href,
      expectedNum: expectedNum,
      items: wait.items || [],
      aiItems: wait.aiItems || [],
      aiText: wait.aiText || '',
      adsCount: wait.adsCount || 0,
      total: (wait.items || []).length,
      early: !!wait.early,
      earlyWhere: wait.hit ? wait.hit.where : null,
      earlyVia: wait.hit ? (wait.hit.via || 'scan') : null,
      selfFetched: !!wait.selfFetched,
      noResults: !!wait.noResults || ((wait.items || []).length === 0 && !wait.timedOut),
      timedOut: !!wait.timedOut,
      settled: !!wait.settled,
      hasNext: !!D.qs('a#pnnext'),
      parsedAt: Date.now()
    };
    live.parsedSent = true;
    const res = await D.msg.send(C.MSG.SERP_PARSED, payload);
    if (payload.early) {
      // قرأنا وكتبنا: قفل نهائي — الصفحة مش هتنزل تاني لحد ما نتنقل للكلمة الجاية
      relock();
    }
    if (globalThis.console && cfg.verbose) {
      console.info('[SRT] SERP parsed', payload.total, 'organic +', payload.aiItems.length, 'ai | early:', payload.early, 'via:', payload.earlyVia, '→', res);
    }
  }

  main().catch((err) => {
    D.msg.send(C.MSG.LOG, { level: 'error', scope: 'serp', text: 'serp main failed: ' + (err && err.message) });
  });
})();
