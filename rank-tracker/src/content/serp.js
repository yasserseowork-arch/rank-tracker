/**
 * serp.js — Content Script لصفحة نتائج جوجل — الإصدار 1.4
 *
 * الإصدار 1.9 — الاستيل القديم الموثوق + قاعدة الـ20 ثانية:
 *  ─ نزول تدريجي بشري + مسح حي بعد كل دفعة نتائج.
 *  ─ أول ما المتجر يظهر بين النتائج → ترتيب فوري وانتقال فوري للكلمة التالية.
 *  ─ 20 ثانية بدون ترتيب = الكلمة تُسجل غير موجود (-) وننتقل.
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
        snippet: sn ? D.textOf(sn) : ''
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

  /* ---------------- AI Overview: توسيع حسب الموجود ثم قراءة ---------------- */
  let aiExpanded = false;

  /** جذر بلوك الذكاء الاصطناعي: محددات معروفة أو البحث عن عنوان «نبذة باستخدام الذكاء الاصطناعي» */
  function aiRoot() {
    let root = D.first(C.SEL.serp.ai);
    if (root) { return root; }
    const head = D.byText('h1, h2, h3, h4, div, span', 'نبذة باستخدام الذكاء الاصطناعي')
      || D.byText('h1, h2, h3, h4, div, span', 'AI Overview');
    if (!head) { return null; }
    root = head.closest('ai-overview, div[data-hveid], div[jscontroller], section, div.uVnmJb');
    if (!root) {
      root = head.parentElement;
      for (let up = 0; up < 4 && root && root.parentElement; up++) {
        root = root.parentElement;
        if (root.querySelectorAll('a[href^="http"]').length >= 1) { break; }
      }
    }
    return root || null;
  }

  async function expandAi() {
    if (aiExpanded) { return; }
    const root = aiRoot();
    if (!root) { return; }
    aiExpanded = true;
    // دوس «عرض المزيد / عرض الكل» مرة أو مرتين حسب اللي ظاهر قدامنا
    for (let round = 0; round < 2; round++) {
      const btn = D.byText('button, [role="button"]', 'عرض المزيد', root)
        || D.byText('button, [role="button"]', 'عرض الكل', root)
        || D.byText('button, [role="button"]', 'Show more', root)
        || D.byText('button, [role="button"]', 'Show all', root);
      if (!btn) { break; }
      D.click(btn, 'ai-expand');
      await D.humanSleep(900, 300);
    }
  }

  function collectAi() {
    const root = aiRoot();
    if (!root) { return { items: [], text: '' }; }
    const links = D.qsa('a[href^="http"]', root);
    const seen = new Set();
    const items = [];
    for (const a of links) {
      if (!a.href || a.href.indexOf('http') !== 0 || seen.has(a.href)) { continue; }
      seen.add(a.href);
      items.push({
        url: a.href,
        host: D.url.hostOf(a.href),
        title: D.textOf(a),
        snippet: D.textOf(a.parentElement || a)
      });
    }
    let text = '';
    try { text = (root.innerText || '').slice(0, 8000); } catch (_) {}
    return { items: items, text: text };
  }

  function hasTarget(cfg) {
    return !!(cfg && ((cfg.storeDomain || '').trim() || (cfg.storeName || '').trim()));
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
    const maxBatches = cfg.selfFetchMaxBatches || 6;

    for (let batch = 0; batch < maxBatches && merged.length < expectedNum; batch++) {
      const u = new URL(href);
      u.searchParams.set('start', String(start));
      let doc = null;
      try {
        const resp = await fetch(u.toString(), { credentials: 'include', redirect: 'follow' });
        if (!resp.ok) { break; }
        const html = await resp.text();
        if (/\/sorry\/|unusual traffic|حركة مرور غير عادية/i.test(html)) {
          D.msg.send(C.MSG.SERP_FETCH_BLOCKED, { reason: 'captcha', pageUrl: u.toString() });
          break;
        }
        doc = new DOMParser().parseFromString(html, 'text/html');
      } catch (_) { break; }
      const more = extractFrom(doc, false);
      if (!more.length) { break; }
      let added = 0;
      for (const item of more) {
        if (!seen.has(item.url)) { seen.add(item.url); merged.push(item); added++; }
      }
      if (!added) { break; }
      start += 10;
      const hit = quickFind(merged, aiItems, cfg);
      if (hit) {
        live.early = true;
        return { items: merged, aiItems: aiItems, early: true, hit: hit, selfFetched: true };
      }
      await D.humanSleep(900, 400);
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
    const n = String(cfg.storeName || '').trim();
    if (n && D.match && D.match.normalizeArabic) {
      const hay = D.match.normalizeArabic(txt);
      const needle = D.match.normalizeArabic(n);
      if (needle && needle.length >= 3 && hay.includes(needle)) { return true; }
    }
    return false;
  }

  /** ترتيب البلوك اللي جواه نص الدومين/الاسم مباشرة + عنصره لو جاهز */
  function positionByText(cfg, items) {
    const blocks = D.qsa('#search .yuRUbf');
    const d = String(cfg.storeDomain || '').trim().toLowerCase();
    const nNorm = (D.match && D.match.normalizeArabic) ? D.match.normalizeArabic(String(cfg.storeName || '')) : '';
    for (let i = 0; i < blocks.length; i++) {
      let t = '';
      try { t = (blocks[i].innerText || '').toLowerCase(); } catch (_) { t = ''; }
      const hitD = d && t.includes(d);
      const hitN = nNorm && nNorm.length >= 3 && D.match.normalizeArabic(t).includes(nNorm);
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
     لأن المتجر مش على الشاشة. بعد القراءة: قفل تاني نهائي. */
  let scrollLocked = true;
  function lockScroll() { try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch (_) {} }
  try {
    window.addEventListener('scroll', () => { if (scrollLocked) { lockScroll(); } }, { passive: true });
    setInterval(() => { if (scrollLocked) { lockScroll(); } }, 250);
  } catch (_) {}
  function relock() { scrollLocked = true; lockScroll(); }
  function releaseScroll() { scrollLocked = false; }

  function logEarly(hit, items) {
    relock();
    const pos = hit && hit.match && hit.match.position ? hit.match.position : (hit && hit.match ? 'AI' : '?');
    D.msg.send(C.MSG.LOG, {
      level: 'info', scope: 'serp',
      text: `⛏ المتجر اتلقى عند #${pos} — وقفنا المسح فوراً (${items.length} نتيجة مقروءة) وانتقلنا للكلمة التالية`
    });
  }

  async function waitForResults(cfg) {
    const maxWait = cfg.maxWaitResultsMs || 20000;
    const batchSettle = cfg.batchSettleMs || 5000;
    const rescan = cfg.rescanMs || 1800;
    const settleMs = cfg.settleMs || 1800;

    let early = null;

    // 1) من أول نتيجة بتظهر: فحص مطابقة كل 250ms — المتجر فوق؟ خروج فوري
    //    بدون أي توسيع AI أو تمرير قبل كده (التوسيع بيتأجل لوقت الحكم بعدم وجوده)
    const firstHit = await D.waitFor(() => {
      const snap = collect();
      if (!snap.items.length) { return D.first(C.SEL.serp.noResults); }
      const ai = collectAi();
      const h = immediateFind(cfg, snap, ai.items);
      if (h) { early = { items: snap.items, ai: ai, hit: h }; }
      return true;
    }, { timeoutMs: Math.min(maxWait, 20000), intervalMs: 250, desc: 'first-result' });

    if (early) {
      logEarly(early.hit, early.items);
      return { items: early.items, aiItems: early.ai.items, aiText: early.ai.text, adsCount: 0, early: true, hit: early.hit };
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
      if (hit) {
        logEarly(hit, snapshot.items);
        return { items: snapshot.items, aiItems: ai.items, aiText: aiText, adsCount: snapshot.adsCount, early: true, hit: hit };
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
      // قاعدة الـ20 ثانية: مفيش ترتيب بعدها = نكتفي بالمقروء
      if (now - started >= maxWait) { break; }

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

    // 3) حكم عدم الوجود: دلوقتي بس وسّع AI وافحص مرة أخيرة قبل الحكم
    await expandAi();
    let items = collect().items;
    const aiF = collectAi();
    let aiItems = aiF.items;
    aiText = aiF.text || aiText;
    const lastHit = quickFind(items, aiItems, cfg);
    if (lastHit) {
      logEarly(lastHit, items);
      return { items: items, aiItems: aiItems, aiText: aiText, adsCount: 0, early: true, hit: lastHit };
    }

    if (cfg.selfFetchMore !== false && !companionSeen && items.length < expectedNum) {
      const sf = await selfFetchMore(cfg, items, aiItems);
      items = sf.items;
      aiItems = sf.aiItems || aiItems;
      if (sf.early) {
        return { items: items, aiItems: aiItems, aiText: aiText, adsCount: 0, early: true, hit: sf.hit, selfFetched: true };
      }
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
