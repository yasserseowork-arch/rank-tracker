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
      D.click(found.button, 'buster-' + scopeName);
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

      // (أ-2) التحدي صوري من غير زر Buster؟ حوّله لصوتي (زر السماعة) مرة كل 5 ثوانٍ
      if (imageOpen() && !audioOpen()) {
        const now = Date.now();
        if (!S.audioSwitchTs || now - S.audioSwitchTs > 5000) {
          S.audioSwitchTs = now;
          switchToAudio();
          await D.humanSleep(700, 250);
          return;
        }
      }

      // (ب) الدور الوحيد: زر Buster (الشخص البرتقالي) — ندوسه وسيبه هو يحل
      const buster = findBusterButton();
      if (!buster) {
        if (Date.now() - S.notFoundTs > 10000) {
          S.notFoundTs = Date.now();
          D.msg.send(C.MSG.CAPTCHA_BUSTER_NOT_FOUND, { frameUrl: href });
        }
        return;
      }

      // (ج) رصد رسالة فشل الاستماع (في وضع الصوت)
      const err = D.first(C.SEL.recaptcha.audioError);
      if (err && err.__srtSeen !== true && D.textOf(err)) {
        err.__srtSeen = true;
        S.lastErrorTs = Date.now();
        D.msg.send(C.MSG.CAPTCHA_ERROR, { text: D.textOf(err), frameUrl: href });
      }

      const max = Math.max(1, cfg.captchaMaxAttempts || 4);
      const timeout = cfg.captchaAttemptTimeoutMs || 35000;

      // (هـ) أول ضغطة Buster تلقائية (first automatic Buster press)
      if (S.attempts === 0) {
        clickBuster('auto-first');
        return;
      }

      // (و) استُنفدت المحاولات → أعلن الفشل مرة واحدة (attempts exhausted → announce failure once)
      if (S.attempts >= max) {
        if (!S.reportedFailed) {
          S.reportedFailed = true;
          D.msg.send(C.MSG.CAPTCHA_FAILED, { attempts: S.attempts, frameUrl: href });
        }
        return;
      }

      // (ز) فشل واضح أو مهلة انتهت → تحدي جديد ⟳ ثم Buster مجدداً (clear failure or timeout ended → new challenge ⟳ then Buster again)
      const needRetry = (S.lastErrorTs > S.lastClickTs) || (Date.now() - S.lastClickTs > timeout);
      if (needRetry) {
        const reload = findReloadButton();
        if (reload) {
          D.click(reload, 'recaptcha-reload');
          await D.humanSleep(900, 300);
        } else {
          await D.humanSleep(800, 300);
        }
        clickBuster('after-reload');
      }
    } finally {
      S.busy = false;
    }
  }

  setInterval(() => { step().catch(() => {}); }, 500);

  /* أوامر المحرك تبقى كخط احتياطي (engine commands remain as a backup line) */
  D.msg.on(C.MSG.CAPTCHA_CMD_NEXT, async () => {
    S.stopped = false;
    const reload = findReloadButton();
    if (reload) {
      D.click(reload, 'recaptcha-reload');
      await D.humanSleep(900, 300);
    }
    const ok = clickBuster('cmd-next');
    return { ok: ok, attempts: S.attempts };
  });

  D.msg.on(C.MSG.CAPTCHA_CMD_STOP, async () => {
    S.stopped = true;
    return { ok: true };
  });

  D.msg.on(C.MSG.CAPTCHA_CMD_PROBE, async () => ({
    role: 'buster',
    busterFound: !!findBusterButton(),
    attempts: S.attempts,
    audioOpen: audioOpen(),
    imageOpen: imageOpen(),
    challengeOpen: challengeOpen(),
    lastErrorTs: S.lastErrorTs,
    lastClickTs: S.lastClickTs,
    frameUrl: href
  }));
})();
