/**
 * captcha.js — Content Script للكابتشا (all_frames) — الإصدار ذاتي القيادة
 *
 * ثلاثة أدوار حسب الإطار:
 *  ─ دور page   (google.com/sorry): يعلن الكابتشا دورياً كل 2.5ث (علاج سباق الأحداث).
 *  ─ دور anchor (iframe الـ checkbox): يراقب الحل، ويضغط الـ checkbox مرة واحدة
 *    إن بقي بدون تحقق (ليفتح التحدي كما يفعل البشر).
 *  ─ دور bframe (نافذة التحدي): آلة حالة ذاتية القيادة:
 *        صورة → تحوّل لصوتي عبر زر السماعة
 *        صوتي → تضغط زر Buster (الشخص البرتقالي)
 *        فشل/مهلة → تضغط ⟳ تحدي جديد ثم Buster مجدداً
 *        حتى الحل أو بلوغ الحد الأقصى (عندها تُبلغ CAPTCHA_FAILED)
 *
 * كل الأدوار ترد على CAPTCHA_CMD_PROBE ليقرأ المحرك الحالة وقتما شاء (state-based).
 */
(function () {
  'use strict';
  const C = globalThis.SRT_C;
  const D = globalThis.SRT;
  if (!C || !D) { return; }

  const href = location.href;
  // حماية مزدوجة: حتى لو تغيّر ترتيب الحقن في manifest لن ننهار أبداً
  const U = D.url || {
    isSorry: (u) => String(u || '').indexOf('/sorry/') !== -1,
    query: (n) => { try { return new URL(location.href).searchParams.get(n) || ''; } catch (_) { return ''; } }
  };
  const isTop = (function () { try { return window.top === window.self; } catch (_) { return false; } })();
  const isSorryTop = isTop && U.isSorry(href);
  const isRecaptchaDoc = href.indexOf('/recaptcha/') !== -1;
  const isAnchor = isRecaptchaDoc && href.indexOf('/anchor') !== -1;
  const isBframe = isRecaptchaDoc && !isAnchor && href.indexOf('/bframe') !== -1;

  function roleByDom() {
    if (D.first(C.SEL.recaptcha.audioChallenge) || D.first(C.SEL.recaptcha.audioInput) || D.first(C.SEL.recaptcha.reload)) {
      return 'buster';
    }
    if (D.qs(C.SEL.recaptcha.anchor)) { return 'anchor'; }
    return null;
  }

  let role = null;
  if (isSorryTop) { role = 'page'; }
  else if (isAnchor) { role = 'anchor'; }
  else if (isBframe) { role = 'buster'; }
  else if (isRecaptchaDoc) { role = roleByDom(); }
  if (!role) { return; }

  D.msg.startHeartbeat('captcha:' + role);

  /** الإعدادات من المحرك (حد المحاولات والمهلة) */
  let cfg = { captchaMaxAttempts: 4, captchaAttemptTimeoutMs: 35000 };
  D.msg.send(C.MSG.GET_CONFIG).then((r) => { if (r && r.config) { cfg = r.config; } });


  /**
   * سائق Buster العام: الإطار/الصفحة اللي شايف زر Buster في مستنده هو اللي يضغطه.
   * في reCAPTCHA Enterprise الزر بيتحقن في الصفحة العليا كـ overlay فوق نافذة
   * التحدي — مش داخل الـ bframe — لذلك السائق ده شغال في دور الصفحة العليا.
   */
  function busterDriver(scopeName) {
    const S2 = { clicked: 0, started: false };

    function popupVisible() {
      const ifs = D.qsa('iframe');
      for (const f of ifs) {
        const src = f.src || '';
        if (src.indexOf('/bframe') !== -1 || src.indexOf('challenge') !== -1) {
          const r = f.getBoundingClientRect();
          if (r && r.width > 50 && r.height > 50) { return true; }
        }
      }
      return false;
    }

    function click(stage) {
      const found = findBusterButton();
      if (!found) { return false; }
      const mk = found.marker;
      const needsCoords = !(mk.tagName === 'BUTTON' || (mk.closest && mk.closest('button')))
        || (mk.tagName === 'IFRAME') || (mk.tagName === 'IMG' && String(mk.src || '').indexOf('chrome-extension://') === 0);
      if (needsCoords) {
        // زرار جوّه iframe/shadow بتاع إضافة تانية: ضغطة DOM مش هتوصله
        // (وزرار Buster أصلاً بيشتغل بضغطة حقيقية بس) → ضغطة ماوس موثوقة بالإحداثيات
        const c = topCoordsOf(found.marker);
        D.msg.send(C.MSG.CAPTCHA_COORD_CLICK, { x: c.x, y: c.y, stage: stage + '-' + scopeName });
      } else {
        D.click(found.button, 'buster-' + scopeName);
      }
      S2.clicked += 1;
      D.msg.send(C.MSG.CAPTCHA_ATTEMPT, { attempt: S2.clicked, stage: stage + '-' + scopeName, frameUrl: href });
      return true;
    }

    setInterval(() => {
      const found = findBusterButton();
      if (!found) { return; }
      // بلّغ المحرك إن الزر موجود هنا (حتى لو الـ bframe مش شايفه)
      D.msg.send(C.MSG.CAPTCHA_BUSTER_SEEN, { scope: scopeName });
      if (!S2.started && popupVisible()) {
        S2.started = true;
        setTimeout(() => { if (findBusterButton()) { click('auto-first'); } }, 700);
      }
    }, 800);

    // أمر إعادة المحاولة: الصفحة العليا تستنى الـ bframe يعمل reload ثم تضغط الزر
    D.msg.on(C.MSG.CAPTCHA_CMD_NEXT, async () => {
      if (!findBusterButton()) { return { ok: false, scope: scopeName }; }
      await D.humanSleep(1800, 400);
      const ok = click('after-reload');
      return { ok: ok, scope: scopeName, attempts: S2.clicked };
    });
  }

  /* ------------------------------------------------------------------ *
   * دور 1: مراقب صفحة الاعتذار — إعلان دوري (يدعم إعادة الحقن المتأخرة)
   * ------------------------------------------------------------------ */
  if (role === 'page') {
    const announce = () => D.msg.send(C.MSG.CAPTCHA_PRESENT, {
      pageUrl: href,
      continueUrl: U.query('continue'),
      hasRecaptchaIframe: !!D.qs('iframe[src*="recaptcha"]')
    });
    announce();
    setInterval(announce, 2500);
    D.observe(document.body, () => {
      if (D.qs('iframe[src*="recaptcha"]')) { announce(); }
    }, { childList: true, subtree: true });
    // الزر بيتحقن في صفحتنا دي (enterprise overlay) → نحن اللي نضغطه
    busterDriver('page');
    return;
  }

  /* ------------------------------------------------------------------ *
   * دور 2: إطار الـ anchor — مراقبة الحل + ضغطة checkbox بشرية واحدة
   * ------------------------------------------------------------------ */
  if (role === 'anchor') {
    let reportedChecked = false;
    let checkboxClicked = false;

    const isChecked = () => !!(D.qs(C.SEL.recaptcha.checkboxChecked) || D.qs(C.SEL.recaptcha.ariaChecked));

    const loop = () => {
      if (!reportedChecked && isChecked()) {
        reportedChecked = true;
        D.msg.send(C.MSG.CAPTCHA_CHECKED, { pageUrl: href });
        return;
      }
      if (!checkboxClicked && !isChecked()) {
        checkboxClicked = true;
        // امنح فرصة للحل المباشر بدون تحدي، ثم اضغط كما يفعل البشر (grant a chance for direct solve, then click like humans do)
        setTimeout(() => {
          if (isChecked()) { return; }
          const box = D.first(C.SEL.recaptcha.checkbox);
          if (box) {
            D.click(box, 'recaptcha-checkbox');
            D.msg.send(C.MSG.CAPTCHA_ATTEMPT, { attempt: 0, stage: 'checkbox-click', frameUrl: href });
          }
        }, 300);
      }
    };

    loop();
    setInterval(loop, 400);
    D.observe(document.body, loop, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-checked'] });
    return;
  }

  /* ------------------------------------------------------------------ *
   * دور 3: إطار التحدي — آلة الحالة ذاتية القيادة
   * ------------------------------------------------------------------ */
  const S = {
    attempts: 0,
    lastClickTs: 0,
    lastErrorTs: 0,
    notFoundTs: 0,
    audioSwitchTs: 0,
    lastReloadTs: 0,
    solveTried: false,   // هل جرّبنا الحل جوه التحدي الحالي؟
    verifyTs: 0,         // وقت آخر ضغطة تحقق (لحساب مهلة الحكم)
    reportedClosed: false,
    reportedFailed: false,
    stopped: false,
    busy: false
  };

  /** إيجاد زر ⟳ التحدي الجديد */
  function findReloadButton() {
    return D.first(C.SEL.recaptcha.reload);
  }

  /** هل التحدي الصوري مفتوح حالياً؟ */
  function imageOpen() {
    return !!D.first(C.SEL.recaptcha.imageChallenge);
  }

  /** هل التحدي الصوتي مفتوح حالياً؟ */
  function audioOpen() {
    return !!(D.first(C.SEL.recaptcha.audioChallenge) || D.first(C.SEL.recaptcha.audioInput));
  }

  /** هل نافذة التحدي مفتوحة أصلاً (صوتي أو صوري أو زر التحدي الجديد موجود)؟ */
  function challengeOpen() {
    return !!(imageOpen() || audioOpen() || findReloadButton());
  }

  /** تحويل التحدي الصوري لصوتي (زر السماعة) عشان زر Buster يظهر ويحل */
  function switchToAudio() {
    const btn = D.first(C.SEL.recaptcha.audioSwitch);
    if (!btn) { return false; }
    D.click(btn, 'recaptcha-audio-switch');
    return true;
  }

  /** تسجيل محاولة ضغط Buster ورفعها للمحرك (عدّاد المحاولات الحي) */
  function reportAttempt(stage) {
    S.attempts += 1;
    S.lastClickTs = Date.now();
    D.msg.send(C.MSG.CAPTCHA_ATTEMPT, { attempt: S.attempts, stage: stage, frameUrl: href });
  }

  /** مسح نطاق واحد (مستند أو shadow root) عن أي أثر للشخص البرتقالي */
  function scanScope(scope) {
    if (!scope || !scope.querySelectorAll) { return null; }
    for (const sel of C.SEL.buster) {
      let nodes = [];
      try { nodes = Array.prototype.slice.call(scope.querySelectorAll(sel)); } catch (_) { nodes = []; }
      for (const node of nodes) {
        const btn = node.closest ? (node.closest('button, [role="button"], a, div[tabindex]') || node.parentElement || node) : node;
        if (btn) { return btn; }
      }
    }
    // مسح خصائص: أي عنصر بيشير لأي امتداد تاني أو لكلمة buster
    let all = [];
    try { all = Array.prototype.slice.call(scope.querySelectorAll('*')); } catch (_) { all = []; }
    for (const el of all) {
      const names = el.getAttributeNames ? el.getAttributeNames() : [];
      for (const n of names) {
        const v = el.getAttribute(n) || '';
        if (v.indexOf('chrome-extension://') !== -1 || v.indexOf('buster') !== -1) {
          const btn = el.closest ? (el.closest('button, [role="button"], a, div[tabindex]') || el.parentElement || el) : el;
          if (btn) { return btn; }
        }
      }
    }
    return null;
  }

  /** الشخص البرتقالي فين ما كان: light DOM أو أي shadow root (Buster بيحقنه كـ web component) */
  function findBusterButton() {
    let hit = scanScope(document);
    if (hit) { return { button: hit, marker: hit }; }
    const all = Array.prototype.slice.call(document.querySelectorAll('*'));
    for (const el of all) {
      if (el.shadowRoot) {
        hit = scanScope(el.shadowRoot);
        if (hit) { return { button: hit, marker: hit }; }
        const nested = Array.prototype.slice.call(el.shadowRoot.querySelectorAll('*'));
        for (const n of nested) {
          if (n.shadowRoot) {
            hit = scanScope(n.shadowRoot);
            if (hit) { return { button: hit, marker: hit }; }
          }
        }
      }
    }
    // الملاذ الأخير الشامل: أي عنصر غريب في صف أزرار التحدي = الشخص البرتقالي
    // (Buster الجديدة بتحقنه كـ iframe/blob بدون أي بصمة امتداد واضحة)
    const reload = findReloadButton();
    if (reload) {
      let row = reload.parentElement;
      for (let up = 0; up < 3 && row; up++) {
        const kids = Array.prototype.slice.call(row.querySelectorAll('iframe, img, button, [role="button"], div, span'));
        const cands = kids.filter((el) => {
          const r = el.getBoundingClientRect();
          if (!r || r.width < 16 || r.width > 90 || r.height < 16 || r.height > 90) { return false; }
          if (el.contains(reload) || reload.contains(el)) { return false; }
          if (el.closest('#recaptcha-reload-button, #recaptcha-audio-button, #recaptcha-verify-button, #recaptcha-help-button, .rc-button-reload, .rc-button-audio-play, .rc-button-default, .rc-button-submit')) { return false; }
          if (/skip|verify|تخط|تحقق|help/i.test(el.textContent || '')) { return false; }
          const cn = String(el.className || '');
          if (/rc-|recaptcha|g-recaptcha/i.test(cn)) { return false; }
          const id = String(el.id || '');
          if (/recaptcha|rc-/i.test(id)) { return false; }
          return true;
        });
        if (cands.length) {
          const pref = cands.filter((el) => el.tagName === 'IFRAME' || el.tagName === 'IMG');
          const pick = pref[0] || cands[cands.length - 1];
          return { button: pick, marker: pick };
        }
        row = row.parentElement;
      }
    }
    return null;
  }

  /** إحداثيات العنصر بالنسبة لشاشة التبويب الكامل (حتى لو داخل إطارات جوجل) */
  function topCoordsOf(el) {
    const r = el.getBoundingClientRect();
    let x = r.left + r.width / 2;
    let y = r.top + r.height / 2;
    let w = window;
    try {
      while (w !== window.top) {
        const fe = w.frameElement;
        if (!fe) { break; }
        const fr = fe.getBoundingClientRect();
        x += fr.left; y += fr.top;
        w = w.parent;
      }
    } catch (_) {}
    return { x: Math.round(x), y: Math.round(y) };
  }

  function clickBuster(stage) {
    const found = findBusterButton();
    if (!found) { return false; }
    const mk = found.marker;
    const needsCoords = !(mk.tagName === 'BUTTON' || (mk.closest && mk.closest('button')))
      || (mk.tagName === 'IFRAME') || (mk.tagName === 'IMG' && String(mk.src || '').indexOf('chrome-extension://') === 0);
    if (needsCoords) {
      // الشخص جوّه iframe بتاع إضافة تانية: الضغطة DOM مش هتوصله → ضغطة ماوس حقيقية بالإحداثيات
      const c = topCoordsOf(found.marker);
      D.msg.send(C.MSG.CAPTCHA_COORD_CLICK, { x: c.x, y: c.y, stage: stage });
    } else {
      D.click(found.button, 'buster-button');
    }
    reportAttempt(stage);
    return true;
  }

  /** انتظار ظهور مصدر صوت التحدي (audio#audio-source) برابط http */
  async function waitAudioSrc(timeoutMs) {
    return D.waitFor(() => {
      const a = D.qs('audio#audio-source');
      return a && String(a.src || '').indexOf('http') === 0 ? a : null;
    }, { timeoutMs: timeoutMs || 12000, intervalMs: 300, desc: 'audio-src' });
  }

  /** عنصر استضافة زرار Buster (الشخص البرتقالي) — موجود بس لو سكربت Buster اشتغل هنا.
   *  سكربت Buster بيشيل #recaptcha-help-button وبيعلّق زراره جوه shadow root مغلق —
   *  فلما الزر الأصلي يختفي نعرف إن زرار Buster اتعلّق مكانه. */
  function busterHolder() {
    const holder = D.qs('.help-button-holder');
    if (holder && !D.qs('#recaptcha-help-button')) { return holder; }
    return null;
  }

  /** نسخ صوت التحدي لنص — بنستخدم خدمة النسخ بتاعة Buster نفسها
   *  (مدمجة في خلفية الإضافة: offscreen + نموذج صوتي محلي) */
  function transcribe(audioUrl, lang, timeoutMs) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (v) => {
        if (settled) { return; }
        settled = true;
        clearTimeout(timer);
        resolve(v);
      };
      const timer = setTimeout(() => finish(null), timeoutMs || 60000);
      try {
        chrome.runtime.sendMessage({ id: 'transcribeAudio', audioUrl: audioUrl, lang: lang || 'en' }, (resp) => {
          if (chrome.runtime.lastError) { finish(null); return; }
          if (typeof resp === 'string') { finish(resp.trim() || null); return; }
          if (resp && (resp.text || resp.result)) { finish(String(resp.text || resp.result).trim() || null); return; }
          finish(null);
        });
      } catch (_) { finish(null); }
    });
  }

  /** كتابة النص في خانة الإجابة بطريقة reCAPTCHA بيسمعها فعلاً */
  function fillResponse(text) {
    const input = D.qs('#audio-response');
    if (!input) { return false; }
    try {
      const proto = Object.getPrototypeOf(input);
      const setter = proto && Object.getOwnPropertyDescriptor(proto, 'value');
      if (setter && setter.set) { setter.set.call(input, text); }
      else { input.value = text; }
    } catch (_) { input.value = text; }
    try {
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) {}
    return true;
  }

  /** تحدي جديد: ⟳ + تجهيز المحاولة الجاية */
  async function newChallenge() {
    const reload = findReloadButton();
    if (reload) {
      D.click(reload, 'recaptcha-reload');
      await D.humanSleep(900, 300);
      return true;
    }
    await D.humanSleep(600, 200);
    return false;
  }

  /** دورة حل واحدة كاملة: نسخ الصوت → كتابة النص → ضغط تحقق */
  async function solveAudioOnce() {
    // 1) نستنى ظهور مصدر الصوت
    const audio = await waitAudioSrc(12000);
    if (!audio) {
      reportAttempt('no-audio-src');
      return { ok: false, why: 'no-audio-src' };
    }

    // 2) نسخ الصوت لنص (نفس محرك Buster المدمج في خلفية الإضافة)
    const src = String(audio.src || '');
    let text = null;
    if (src.indexOf('blob:') !== 0) {
      text = await transcribe(src, (document.documentElement && document.documentElement.lang) || 'en', 60000);
    }

    if (!text) {
      // 3-أ) البديل: ضغطة ماوس حقيقية (موثوقة) على زرار Buster لو متعلّق — هو اللي يحل بنفسه
      const holder = busterHolder();
      if (holder) {
        const c = topCoordsOf(holder);
        D.msg.send(C.MSG.CAPTCHA_COORD_CLICK, { x: c.x, y: c.y, stage: 'audio-no-transcript' });
        reportAttempt('buster-coords');
        S.verifyTs = Date.now(); // بنعتبرها محاولة كاملة — لو ما حلتش هنتحدى من جديد
        return { ok: true, via: 'buster-coords' };
      }
      reportAttempt('transcribe-failed');
      return { ok: false, why: 'no-transcript' };
    }

    // 3-ب) نكتب النص ونضغط تحقق
    if (!fillResponse(text)) {
      reportAttempt('no-input');
      return { ok: false, why: 'no-input' };
    }
    reportAttempt('audio-solve');
    const verify = D.first(C.SEL.recaptcha.verify);
    if (verify) {
      D.click(verify, 'recaptcha-verify');
    } else {
      // من غير زرار تحقق؟ Enter في خانة الإجابة
      const input = D.qs('#audio-response');
      if (input) {
        try {
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
          input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        } catch (_) {}
      }
    }
    S.verifyTs = Date.now();
    return { ok: true, via: 'audio' };
  }

  async function step() {
    if (S.stopped || S.busy) { return; }
    S.busy = true;
    try {
      // (أ) التحدي اختفى بعد محاولات = تحقق ناجح على الأغلب (challenge disappeared after attempts = likely successful verification)
      if (!challengeOpen()) {
        if (S.attempts > 0 && !S.reportedClosed) {
          S.reportedClosed = true;
          D.msg.send(C.MSG.CAPTCHA_CHALLENGE_CLOSED, { frameUrl: href });
        }
        return;
      }

      // (ب) التحدي صوري؟ حوّله لصوتي (زر السماعة) مرة كل 5 ثوانٍ — الصوت هو اللي بنعرف نحله
      if (imageOpen() && !audioOpen()) {
        const now = Date.now();
        if (!S.audioSwitchTs || now - S.audioSwitchTs > 5000) {
          S.audioSwitchTs = now;
          switchToAudio();
          await D.humanSleep(700, 250);
        }
        return; // بنستنى ظهور التحدي الصوتي
      }

      // (ج) التحدي الصوتي مفتوح → الحل الذاتي الحقيقي (نسخ الصوت → كتابة النص → تحقق)
      if (audioOpen()) {
        const max = Math.max(1, cfg.captchaMaxAttempts || 4);

        // رصد رسالة فشل الاستماع (لو ظهرت) عشان السجل يبقى واضح
        const err = D.first(C.SEL.recaptcha.audioError);
        if (err && err.__srtSeen !== true && D.textOf(err)) {
          err.__srtSeen = true;
          S.lastErrorTs = Date.now();
          D.msg.send(C.MSG.CAPTCHA_ERROR, { text: D.textOf(err), frameUrl: href });
        }

        // استُنفدت المحاولات → أعلن الفشل مرة واحدة (attempts exhausted → announce failure once)
        if (S.attempts >= max) {
          if (!S.reportedFailed) {
            S.reportedFailed = true;
            D.msg.send(C.MSG.CAPTCHA_FAILED, { attempts: S.attempts, frameUrl: href });
          }
          return;
        }

        // محاولة حل واحدة لكل تحدي (نستنى نسخ الصوت والرد)
        if (!S.solveTried) {
          S.solveTried = true;
          await solveAudioOnce();
          return;
        }

        // ضغطنا تحقق والحكم لسه نازل → صبر قصير
        if (S.verifyTs && Date.now() - S.verifyTs < 4500) { return; }

        // التحدي لسه مفتوح بعد التحقق = الإجابة غلط → تحدي جديد ⟳ ومحاولة تانية
        S.verifyTs = 0;
        S.solveTried = false;
        await newChallenge();
        return;
      }

      // (د) تحدي مفتوح بس مش صوتي ولا صوري (حالة انتقالية نادرة) — ريلود كل 15 ثانية
      if (!S.lastReloadTs || Date.now() - S.lastReloadTs > 15000) {
        S.lastReloadTs = Date.now();
        await newChallenge();
      }
    } finally {
      S.busy = false;
    }
  }

  setInterval(() => { step().catch(() => {}); }, 500);

  /* أوامر المحرك تبقى كخط احتياطي (engine commands remain as a backup line) */
  D.msg.on(C.MSG.CAPTCHA_CMD_NEXT, async () => {
    S.stopped = false;
    S.solveTried = false;
    S.verifyTs = 0;
    await newChallenge(); // الآلة بتلقط التحدي الجديد وبتكمل الحل لوحدها
    return { ok: true, attempts: S.attempts };
  });

  D.msg.on(C.MSG.CAPTCHA_CMD_STOP, async () => {
    S.stopped = true;
    return { ok: true };
  });

  D.msg.on(C.MSG.CAPTCHA_CMD_PROBE, async () => ({
    role: 'buster',
    busterFound: !!findBusterButton() || !!busterHolder(),
    attempts: S.attempts,
    audioOpen: audioOpen(),
    imageOpen: imageOpen(),
    challengeOpen: challengeOpen(),
    lastErrorTs: S.lastErrorTs,
    lastClickTs: S.lastClickTs,
    frameUrl: href
  }));
})();
