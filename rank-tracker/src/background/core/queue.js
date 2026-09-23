/**
 * queue.js — محرك الطابور: دورة حياة كاملة لكل كلمة مفتاحية
 *
 *  [مهلة بشرية] → [فتح SERP بـ gl=sa&hl=ar&num=100] → [انتظار التحميل]
 *      ├─ نتائج → تمرير بشري → قراءة 100 نتيجة → مطابقة → حفظ الترتيب
 *      └─ كابتشا → منسّق Buster → (حل؟) → انتظار SERP → مطابقة → حفظ
 *             └─ فشل → إيقاف مؤقت للتنبيه أو تخطٍّ حسب الإعداد
 */
import { C } from './bridge.js';
import { bus } from './bus.js';
import * as state from './state.js';
import * as logger from './logger.js';
import * as tabctl from './tabctl.js';
import * as scheduler from './scheduler.js';
import * as urlkit from './urlkit.js';
import { localCheck } from './localcheck.js';
import { matchResults, nameMatches, normalizeArabic } from './match.js';
import * as csvkit from './csvkit.js';
import { CaptchaOrchestrator } from './captcha-orchestrator.js';
import { sleep } from './rand.js';
import * as solver from './solver.js';

export class QueueEngine {
  constructor() {
    this.orchestrator = new CaptchaOrchestrator();
    this.looping = false;
    this.ownedTabs = new Set(); // تبانين فتحتهم الأداة — بنخليها واحدة واحدة بس
    this.pendingRestart = false;
    this.index = 0;
    this.abortController = null;
    this.currentTabId = null;
    this.wireBus();
  }

  /**
   * ساعة حراسة: إن مات الـ Service Worker في منتصف كلمة (لا عملاء keep-alive)،
   * يوقظه alarm بعد دقيقتين ويستأنف الحلقة من currentIndex المحفوظة.
   */
  armWatchdog() {
    try { chrome.alarms.create('srt-watch', { delayInMinutes: 2 }); } catch (_) {}
  }

  disarmWatchdog() {
    try { chrome.alarms.clear('srt-watch'); } catch (_) {}
  }

  async watchdogTick() {
    const run = await state.getRun();
    const errored = run.status === C.STATUS.RUN.PAUSED && String(run.pauseReason || '').indexOf('error:') === 0;
    const active = run.status === C.STATUS.RUN.RUNNING || run.status === C.STATUS.RUN.CAPTCHA || errored;
    if (active && !this.looping) {
      await logger.warn('queue', 'watchdog: استئناف الحلقة بعد استيقاظ Worker' + (errored ? ' — تعافي تلقائي بعد خطأ' : ''));
      await state.setRun({ status: C.STATUS.RUN.RUNNING, captcha: null, pauseReason: null });
      this.index = run.currentIndex || 0;
      this.abortController = new AbortController();
      this.loop();
    } else if (active) {
      this.armWatchdog();
    } else {
      this.disarmWatchdog();
    }
  }

  /** ربط رسائل الـ content scripts بالناقل الداخلي مع tabId */
  wireBus() {
    const forward = (type) => (message, sender) => {
      const payload = Object.assign({}, message, { tabId: sender && sender.tab ? sender.tab.id : null });
      bus.emit(type, payload);
    };
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message) { return; }
      // خدمة النسخ باسمها الأصلي (بروتوكول 1.18.6) — الآن ترد عليها خلفية أداتنا بمحركها الخاص
      if (message.id === 'transcribeAudio' && message.audioUrl) {
        (async () => {
          try {
            const text = await solver.transcribeAudioUrl(String(message.audioUrl));
            sendResponse({ text: text || null });
          } catch (err) {
            await logger.warn('solver', 'النسخ فشل: ' + (err && err.message));
            sendResponse({ text: null, reason: 'error' });
          }
        })();
        return true;
      }
      if (typeof message.type !== 'string' || message.type.indexOf('srt/') !== 0) { return; }

      /* ---- حارس الديبراجر: بانر «started debugging» يظهر في تابات الشغل بس ----
         (طلب: «الـdebuging يظهر في الحساب اللي عليه الأداة بس، مش كل حسابات جوجل»).
         الآلة نفسها حرة زي 1.18.6 — التقييد على الضغطة الموثوقة (debugger) فقط. */
      const tabOf = sender && sender.tab ? sender.tab.id : null;
      const inScope = async () => {
        if (!tabOf) { return false; }
        const run = await state.getRun();
        if (run.workerTabId === tabOf) { return true; }
        return Array.isArray(run.ownedTabIds) && run.ownedTabIds.indexOf(tabOf) !== -1;
      };

      // ضغطة ماوس حقيقية بالإحداثيات (موثوقة — isTrusted) من داخل تبويب:
      // بتوصل من إطار التحدي (زرار Buster) أو من الصفحة العليا (زرار التحقق الصوتي)
      const coordMsg = message.type === C.MSG.CAPTCHA_COORD_CLICK || message.type === C.MSG.CAPTCHA_VERIFY_CLICK;
      if (coordMsg && sender.tab && sender.tab.id) {
        const tabId = sender.tab.id;
        (async () => {
          // تبويب شخصي للمستخدم؟ مفيش debugger ولا ضغطات — خالص (الحارس الأول)
          if (!(await inScope())) { sendResponse({ ok: false, error: 'out-of-scope' }); return; }
          try {
            const target = { tabId: tabId };
            try { await chrome.debugger.attach(target, '1.3'); } catch (_) { /* مثبت بالفعل */ }
            const evt = { x: message.x, y: message.y, button: 'left', clickCount: 1 };
            // رتم بشري: الماوس يتحرك الأول ويستقر، ضغط، سكتة قصيرة، فك — وراحة قبل الـdetach
            await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x: message.x, y: message.y, button: 'none' });
            await new Promise((r) => setTimeout(r, 140));
            await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', Object.assign({ type: 'mousePressed' }, evt));
            await new Promise((r) => setTimeout(r, 90));
            await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', Object.assign({ type: 'mouseReleased' }, evt));
            await new Promise((r) => setTimeout(r, 150));
            try { await chrome.debugger.detach(target); } catch (_) {}
            await logger.info('captcha', `🖱 ضغطة حقيقية بالإحداثيات (${message.x},${message.y}) — ${message.stage || ''}`);
            sendResponse({ ok: true });
          } catch (err) {
            await logger.warn('captcha', `تعذرت الضغطة بالإحداثيات: ${err && err.message}`);
            sendResponse({ ok: false, error: String(err && err.message) });
          }
        })();
        return true;
      }
      const known = [C.MSG.SERP_STARTED, C.MSG.SERP_PARSED, C.MSG.SERP_ERROR, C.MSG.SERP_FETCH_BLOCKED, C.MSG.CAPTCHA_PRESENT, C.MSG.CAPTCHA_CHECKED,
        C.MSG.CAPTCHA_ATTEMPT, C.MSG.CAPTCHA_ERROR, C.MSG.CAPTCHA_CHALLENGE_CLOSED, C.MSG.CAPTCHA_FAILED,
        C.MSG.CAPTCHA_BUSTER_NOT_FOUND, C.MSG.KEEPALIVE, C.MSG.LOG];
      if (!known.includes(message.type)) { return; }
      const payload = Object.assign({}, message, { tabId: sender && sender.tab ? sender.tab.id : null });
      bus.emit(message.type, payload);
      if (message.type === C.MSG.KEEPALIVE) { sendResponse({ ok: true }); }
      else if (message.type === C.MSG.LOG) {
        logger.log(message.level || 'info', message.scope || 'content', message.text || '', message.data);
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: true });
      }
    });

    // تخزين آخر تحليل لكل تبويب — يعالج سباق «الحل جه والتحليل وصل قبل ما نستمع»
    this.lastSerp = this.lastSerp || new Map();
    bus.on(C.MSG.SERP_PARSED, (p) => {
      if (p && p.tabId) { this.lastSerp.set(p.tabId, { payload: p, ts: Date.now() }); }
    });
    bus.on(C.MSG.CAPTCHA_ATTEMPT, (m) => {
      logger.info('captcha', `محاولة حل من الآلة الذاتية (${m.stage || '?'}) — tab:${m.tabId}`);
      if (this.currentTabId === m.tabId) {
        state.setRun({ captcha: Object.assign({}, { tabId: m.tabId, attempts: m.attempt, since: Date.now() }) });
        this.broadcast();
      }
    });
    bus.on(C.MSG.CAPTCHA_ERROR, (m) => {
      logger.warn('captcha', `رسالة خطأ من reCAPTCHA: ${m.text || '-'}`);
    });
    bus.on(C.MSG.CAPTCHA_BUSTER_NOT_FOUND, (m) => {
      logger.warn('captcha', `Buster غير مرئية (tab:${m.tabId}) — المحرك الصوتي المدمج يتولى الحل تلقائياً، ولو استنفد المحاولات هتجيلك notification للحل اليدوي.`);
    });
    bus.on(C.MSG.SERP_ERROR, (m) => {
      logger.warn('serp', `صفحة خطأ (${m.kind}) لكلمة "${m.keyword}" — ريفرش تلقائي: ${m.reload ? 'نعم (' + m.attempt + ')' : 'استُنفد الحد'}`);
    });
    bus.on(C.MSG.SERP_FETCH_BLOCKED, (m) => {
      logger.warn('serp', `الجلب الخلفي للدفعات اصطدم بكابتشا — نكتفي بالنتائج المعروضة بالصفحة (${m.pageUrl || ''})`);
    });
    bus.on(C.MSG.CAPTCHA_FAILED, (m) => {
      logger.warn('captcha', `الكابتشا استهلكت محاولاتها من غير حل (tab:${m.tabId}) — الخطة الاحتياطية اتنفذّت: مسح بيانات + تبويب جديد لنفس الكلمة`);
    });
  }

  broadcast() {
    state.snapshot().then((snap) => {
      try {
        chrome.runtime.sendMessage(Object.assign({ type: C.MSG.STATE_BROADCAST }, snap), () => { void chrome.runtime.lastError; });
      } catch (_) {}
    });
  }

  /* الإشعارات جوه اللوحة نفسها (مكان شريط الاستراحة) — مش نوتيفيكيشن عام في الجهاز.
   *  أي شاشة/أي حساب — الرسالة تبقى في الأداة، بسيطة وواضحة، واللوحة بتختفي لوحدها. */
  async notify(title, message) {
    try {
      await state.setRun({ notice: { title: title, text: message, ts: Date.now() } });
      this.broadcast();
    } catch (_) {}
  }

  clearNotice() {
    state.setRun({ notice: null }).then(() => this.broadcast()).catch(() => {});
  }

  /* ------------------------------ أوامر التحكم ------------------------------ */

  async start() {
    const run = await state.getRun();
    if (run.status === C.STATUS.RUN.RUNNING || run.status === C.STATUS.RUN.CAPTCHA) {
      return { ok: false, reason: 'already-running' };
    }
    const keywords = await state.getKeywords();
    if (!keywords.length) { return { ok: false, reason: 'no-keywords' }; }
    const cfg = await state.getConfig();
    if (!cfg.storeDomain && !cfg.storeName && !cfg.storeNameEn) { return { ok: false, reason: 'no-target' }; }
    const daily = await state.getDailyCount();
    if (cfg.maxChecksPerDay > 0 && daily.count >= cfg.maxChecksPerDay) {
      await logger.warn('queue', `تم بلوغ السقف اليومي (${cfg.maxChecksPerDay} فحصاً) — ارفعه من الإعدادات المتقدمة أو انتظر الغد`);
      return { ok: false, reason: 'daily-cap' };
    }

    // 0) مسح بيانات التصفح (كل الوقت) — نتائج غير شخصية مثل السيناريو اليدوي
    if (cfg.clearBeforeRun) {
      try {
        await chrome.browsingData.remove({ since: 0 }, { cacheStorage: true, history: true, cookies: true });
        await logger.info('queue', '🧹 مُسحت بيانات التصفح (كل الوقت) قبل البدء — سيرب غير شخصي');
      } catch (err) {
        await logger.warn('queue', 'تعذّر مسح بيانات التصفح: ' + (err && err.message));
      }
    }


    this.index = keywords.findIndex((k) => k.status === C.STATUS.KW.PENDING);
    if (this.index === -1) {
      // إعادة تعيين الحالات المستهلكة لبدء دورة جديدة
      await state.setKeywords(keywords.map((k) => Object.assign({}, k, { status: C.STATUS.KW.PENDING })));
      this.index = 0;
    }
    this.abortController = new AbortController();
    await state.setRun({
      status: C.STATUS.RUN.RUNNING,
      currentIndex: this.index,
      startedAt: Date.now(),
      finishedAt: null,
      pauseReason: null,
      captcha: null,
      checked: 0, found: 0, captchaSolves: 0, failures: 0
    });
    await logger.info('queue', `▶ بدء التشغيل: ${keywords.length - this.index} كلمة متبقية`);
    this.broadcast();
    this.loop();
    return { ok: true };
  }

  async pause(reason) {
    const run = await state.getRun();
    if (run.status !== C.STATUS.RUN.RUNNING && run.status !== C.STATUS.RUN.CAPTCHA) { return { ok: false }; }
    await state.setRun({ status: C.STATUS.RUN.PAUSED, pauseReason: reason || 'user' });
    if (this.abortController) { this.abortController.abort(); }
    await logger.warn('queue', `⏸ إيقاف مؤقت (${reason || 'user'})`);
    this.broadcast();
    return { ok: true };
  }

  async resume() {
    const run = await state.getRun();
    if (run.status === C.STATUS.RUN.RUNNING) { return { ok: false }; }
    // إلغاء أي عملية معلّقة (مثل انتظار الحل اليدوي) لتتفكك بأمان
    if (this.abortController) { this.abortController.abort(); }
    this.abortController = new AbortController();
    await state.setRun({ status: C.STATUS.RUN.RUNNING, pauseReason: null });
    await logger.info('queue', '⏩ استئناف التشغيل');
    this.broadcast();
    if (this.looping) {
      // الحلقة القديمة ما زالت تتفكك — ستعيد الدخول تلقائياً عند الانتهاء
      this.pendingRestart = true;
    } else {
      this.loop();
    }
    return { ok: true };
  }

  async stop() {
    this.pendingRestart = false;
    if (this.abortController) { this.abortController.abort(); }
    this.disarmWatchdog();
    // التبويب العامل لا يُغلق: يبقى جاهزاً للاستئناف السريع
    this.currentTabId = null;
    const keywords = await state.getKeywords();
    await state.setKeywords(keywords.map((k) =>
      k.status === C.STATUS.KW.RUNNING || k.status === C.STATUS.KW.CAPTCHA
        ? Object.assign({}, k, { status: C.STATUS.KW.PENDING })
        : k));
    await state.setRun({ status: C.STATUS.RUN.IDLE, captcha: null, pauseReason: null });
    await logger.warn('queue', '⏹ إيقاف التشغيل');
    this.broadcast();
    return { ok: true };
  }

  async closeCurrentTab() {
    if (this.currentTabId) {
      await tabctl.close(this.currentTabId);
      this.currentTabId = null;
    }
  }

  /** التبويب العامل الحيّ المحفوظ في حالة التشغيل (إن وجد) */
  async aliveWorkerTab() {
    const run = await state.getRun();
    const id = run.workerTabId || this.currentTabId;
    if (id && (await tabctl.isAlive(id))) { return { id: id }; }
    return null;
  }

  /** أمر كتابة الكلمة في صندوق البحث داخل تبويب قائم */
  async sendSearchCmd(tabId, keyword) {
    try {
      return await chrome.tabs.sendMessage(tabId, { type: C.MSG.SERP_CMD_SEARCH, keyword: keyword });
    } catch (_) {
      return null;
    }
  }

  /* -------------------------------- الحلقة utama -------------------------------- */

  async loop() {
    if (this.looping) { return; }
    this.looping = true;
    this.armWatchdog();
    let brokeForPause = false;
    try {
      for (;;) {
        const run = await state.getRun();
        if (run.status !== C.STATUS.RUN.RUNNING) { brokeForPause = true; break; }
        const keywords = await state.getKeywords();
        if (this.index >= keywords.length) { break; }
        const kw = keywords[this.index];
        await state.setRun({ currentIndex: this.index });
        this.armWatchdog();
        const outcome = await this.runKeyword(kw);
        if (outcome === 'paused') { brokeForPause = true; break; }
        this.index += 1;
        const processed = this.index;
        const cfg = await state.getConfig();
        await scheduler.cooldownIfNeeded(cfg, processed, this.signal(), async (ms) => {
          // عدّاد حي في اللوحة: وقت بداية الاستراحة ومداها — الشريط يظهر بس وإنت في واحدة بجد
          await state.setRun({ breakUntil: Date.now() + ms, breakTotalMs: ms });
          this.broadcast();
        });
        await state.setRun({ breakUntil: null, breakTotalMs: null });
        this.broadcast();
      }
      const run = await state.getRun();
      const exhausted = this.index >= (await state.getKeywords()).length;
      if (run.status === C.STATUS.RUN.RUNNING && exhausted && !brokeForPause) {
        await state.setRun({ status: C.STATUS.RUN.IDLE, finishedAt: Date.now(), captcha: null });
        await logger.info('queue', '✅ انتهى فحص كل الكلمات المفتاحية');
        // «تاب واحد بس»: خلص الشغل → مفيش سبب يفضل أي تاب مفتوح للأداة
        try {
          await this.sweepExtraTabs(null);
          await state.setRun({ workerTabId: null, ownedTabIds: [] });
          this.currentTabId = null;
        } catch (_) {}
        // كتابة النتائج في الشيت إن فُعّلت (مثل السيناريو اليدوي)
        const cfg = await state.getConfig();
        if (cfg.sheetUrl && String(cfg.sheetUrl).trim()) {
          await this.writeResultsToSheet();
        }
        // النافذة الخاصة بالأداة تتقفل أول ما الشغل يخلص (لو مضايفة على تبويباتنا بس)
        try { await tabctl.closeToolWindowIfEmpty(); } catch (_) {}
      }
    } catch (err) {
      await logger.error('queue', 'خطأ غير متوقع في الحلقة: ' + (err && err.stack ? err.stack : err));
      await state.setRun({ status: C.STATUS.RUN.PAUSED, pauseReason: 'error:' + (err && err.message) });
      await this.notify('⚠️ الأداة وقفت', 'حصل خطأ غير متوقع — الواتش دوج هيحاول استئنافها لوحده خلال دقيقتين. لو مكملتش، دوس استئناف من اللوحة.');
    } finally {
      this.looping = false;
      if (this.pendingRestart) {
        this.pendingRestart = false;
        this.broadcast();
        this.loop();
        return;
      }
      const run = await state.getRun();
      if (run.status !== C.STATUS.RUN.RUNNING) { this.disarmWatchdog(); }
      this.broadcast();
    }
  }

  signal() {
    return this.abortController ? this.abortController.signal : null;
  }

  /* ---------------------------- دورة الكلمة الواحدة ---------------------------- */

  async runKeyword(kw) {
    const cfg = await state.getConfig();
    const signal = this.signal();
    await state.updateKeyword(kw.id, { status: C.STATUS.KW.RUNNING });
    await logger.info('queue', `🔎 فحص الكلمة: "${kw.keyword}"`);
    this.broadcast();

    // مسح دوري ذكي: بعد كل N كلمة مفحوصة (افتراضي 8 — متزامن مع الاستراحة) — بصمة أقل وكابتشا أقل
    await this.maybePeriodicClear(cfg);

    // 1) المهلة الإلزامية قبل كل كلمة
    await scheduler.preKeywordDelay(cfg, { index: this.index }, signal);
    if (signal && signal.aborted) { return this.abortKeyword(kw, 'paused'); }

    // 2) تجهيز التبويب (واحد دائم + الكلمة من صندوق البحث)
    const url = urlkit.buildSearchUrl(kw.keyword, cfg);
    let tab = null;
    let navigatedViaBox = false;
    if (cfg.reuseTab !== false) {
      tab = await this.aliveWorkerTab();
      if (tab) {
        const resp = await this.sendSearchCmd(tab.id, kw.keyword);
        if (resp && resp.ok) { navigatedViaBox = true; }
      }
    }
    if (!tab) {
      try {
        tab = await tabctl.open(url, cfg);
        await state.setRun({ workerTabId: tab.id });
        this.ownedTabs.add(tab.id);
        await this.sweepExtraTabs(tab.id);
      } catch (_) {
        await state.updateKeyword(kw.id, { status: C.STATUS.KW.FAILED });
        await this.notify('❌ فشل', `تعذر فتح تبويب للكلمة: ${kw.keyword}`);
        return 'done';
      }
    } else if (!navigatedViaBox) {
      await tabctl.navigate(tab.id, url);
    }
    this.currentTabId = tab.id;

    const maxRetries = cfg.keywordRetries == null ? 2 : cfg.keywordRetries;
    const maxClears = cfg.captchaClearRetries == null ? 2 : cfg.captchaClearRetries;
    let captchaClears = 0;

    // 3) لفة المحاولة: أي مشكلة = ريفرش + نفس الكلمة (وآخر فرصة تاب جديد)
    for (let attempt = 0; ; attempt++) {
      if (signal && signal.aborted) { return this.abortKeyword(kw, 'paused'); }

      if (!navigatedViaBox || attempt > 0) {
        const load = await tabctl.waitForComplete(tab.id, C.LIMITS.TAB_LOAD_TIMEOUT_MS);
        if (!load.ok) {
          if (attempt >= maxRetries) {
            await this.notify('⚠️ بعد كل المحاولات', `"${kw.keyword}" — تحميل ناقص مستمر؛ سُجلت كغير موجود`);
            return this.recordExhausted(kw, cfg);
          }
          await logger.warn('queue', `🔄 تحميل ناقص — ريفرش ونفس الكلمة (${attempt + 1}/${maxRetries})`);
          await this.notify('🔄 إعادة محاولة', `تحميل ناقص — ريفرش ونفس الكلمة: ${kw.keyword}`);
          await tabctl.reload(tab.id);
          navigatedViaBox = false;
          continue;
        }
        const cu = await tabctl.getUrl(tab.id);
        if (/chrome-error:|chrome:\/\/error/.test(cu)) {
          if (attempt >= maxRetries) {
            await this.notify('⚠️ بعد كل المحاولات', `"${kw.keyword}" — خطأ شبكة متكرر؛ سُجلت كغير موجود`);
            return this.recordExhausted(kw, cfg);
          }
          await logger.warn('queue', `🔄 صفحة خطأ شبكة — ريفرش ونفس الكلمة (${attempt + 1}/${maxRetries})`);
          await this.notify('🔄 إعادة محاولة', `خطأ شبكة — ريفرش ونفس الكلمة: ${kw.keyword}`);
          await tabctl.reload(tab.id);
          navigatedViaBox = false;
          continue;
        }
      }

      const first = await this.raceSerpOrCaptcha(tab.id, cfg, signal);
      if (first.type === 'aborted') { return this.abortKeyword(kw, 'paused'); }

      // 4) كابتشا ظهرت؟ أولاً: حل تلقائي بالكامل (Buster مدمجة + إطار التحدي ذاتي القيادة) — بدون أي تدخل منك
      if (first.type === 'captcha') {
        const solveStartedAt = Date.now();
        const auto = await this.handleCaptcha(tab.id, kw, cfg, signal, false);
        if (auto === 'solved') {
          // الصفحة بعد الحل محتاجة راحتها: تحميل + تحليل — مفيش استعجال على أي مسح
          const sAfter = await this.collectAfterSolve(tab.id, solveStartedAt, signal);
          if (sAfter) { return this.recordResult(kw, sAfter, cfg, 'captcha-auto-solved'); }
        }
        if (signal && signal.aborted) { return this.abortKeyword(kw, 'paused'); }
        // فشل الحل التلقائي: الخطة الاحتياطية — مسح بيانات المتصفح + نفس الكلمة في تاب جديد
        if (captchaClears >= maxClears) {
          await this.notify('⚠️ كابتشا متكررة', `"${kw.keyword}" — كابتشا حتى بعد محاولة الحل التلقائي ومسح البيانات؛ سُجلت كغير موجود`);
          return this.recordExhausted(kw, cfg);
        }
        captchaClears += 1;
        // 😴 تبريد قصير قبل أي إعادة: صفحة /sorry/ بتحتاج وقت بسيط يهدى فيه العدّاد،
        // بس من غير ما نطوّلك الاستنى — 12 ثانية ثم 16 ثم 20 (كل دورة أطول شوية بس).
        const restSec = 8 + captchaClears * 4; // 12 / 16 / 20 ثانية
        await this.notify('🧩 كابتشا', `تبريد ${restSec} ثانية، وبعدها مسح بيانات وإعادة "${kw.keyword}" في تاب واحد نظيف (${captchaClears}/${maxClears})`);
        await logger.warn('queue', `🧩 كابتشا — فشل الحل التلقائي: تبريد ${restSec}ث ثم مسح بيانات + تاب جديد (${captchaClears}/${maxClears})`);
        await sleep(restSec * 1000, signal);
        if (signal && signal.aborted) { return this.abortKeyword(kw, 'paused'); }
        let nextTab = null;
        try {
          nextTab = await tabctl.open(url, Object.assign({}, cfg, { foregroundTab: true }));
        } catch (_) {}
        if (!nextTab) {
          await this.notify('⚠️ بعد كل المحاولات', `"${kw.keyword}" — تعذر فتح تاب جديد بعد الكابتشا`);
          return this.recordExhausted(kw, cfg);
        }
        // تاب واحد مضمون: الجديد يفتح، القديم وكل فائض يتقفل، وبعدين المسح —
        // ما يبقاش في شبح تاب كابتشا قديم يربك الجلسة وقت ما البيانات بتمسح
        this.ownedTabs.add(nextTab.id);
        await tabctl.close(tab.id);
        this.ownedTabs.delete(tab.id);
        tab = nextTab;
        await state.setRun({ workerTabId: tab.id });
        this.currentTabId = tab.id;
        await this.sweepExtraTabs(tab.id);
        try {
          await chrome.browsingData.remove({ since: 0 }, { cacheStorage: true, cookies: true, history: true });
        } catch (_) {}
        navigatedViaBox = false;
        continue; // نفس الكلمة من الأول في التبويب الجديد
      } else if (first.type === 'serp' && first.payload.total > 0) {
        // 5) نتائج سليمة: سجل وامشي
        return this.recordResult(kw, first.payload, cfg, 'direct');
      }
      // سيرب بصفر نتائج = مشكلة (بلوك ناعم) → ريفرش ونفس الكلمة في أسفل اللفة

      // 6) مشكلة (تايم‌آوت / تحليل فاضي / نتائج مابعدش الكابتشا): ريفرش + نفس الكلمة
      if (attempt >= maxRetries) {
        // آخر فرصة: تاب جديد بنفس الكلمة ثم استسلام موثق بإشعار
        await logger.warn('queue', `🆕 مشكلة مستمرة — تاب جديد لنفس الكلمة "${kw.keyword}" كمحاولة أخيرة`);
        await this.notify('🆕 محاولة أخيرة', `مشكلة مستمرة على "${kw.keyword}" — تاب جديد`);
        try {
          const lastTab = await tabctl.open(url, Object.assign({}, cfg, { foregroundTab: true }));
          await tabctl.close(tab.id);
          tab = lastTab || tab;
          this.ownedTabs.add(tab.id);
          await state.setRun({ workerTabId: tab.id });
          this.currentTabId = tab.id;
          await this.sweepExtraTabs(tab.id);
          const lastRace = await this.raceSerpOrCaptcha(tab.id, cfg, signal);
          if (lastRace.type === 'serp' && (lastRace.payload.total > 0 || lastRace.payload.noResults)) {
            return this.recordResult(kw, lastRace.payload, cfg, 'new-tab');
          }
          if (lastRace.type === 'captcha') {
            const solveStartedAt2 = Date.now();
            const h2 = await this.handleCaptcha(tab.id, kw, cfg, signal, false);
            if (h2 === 'solved') {
              const s2 = await this.collectAfterSolve(tab.id, solveStartedAt2, signal);
              if (s2) { return this.recordResult(kw, s2, cfg, 'new-tab-captcha'); }
            }
          }
        } catch (_) {}
        await this.notify('⚠️ بعد كل المحاولات', `"${kw.keyword}" — استنفدنا ريفرش + تاب جديد؛ سُجلت كغير موجود`);
        return this.recordExhausted(kw, cfg);
      }

      const kind = first.type === 'timeout' ? 'تايم‌آوت بدون نتائج' : 'تحليل فاضي/ناقص';
      await logger.warn('queue', `🔄 مشكلة (${kind}) — ريفرش ومحاولة نفس الكلمة "${kw.keyword}" (${attempt + 1}/${maxRetries})`);
      await this.notify('🔄 إعادة محاولة', `مشكلة (${kind}) — ريفرش ونفس الكلمة: ${kw.keyword}`);
      await tabctl.reload(tab.id);
      navigatedViaBox = false;
      continue;
    }
  }

  abortKeyword(kw, reason) {
    state.updateKeyword(kw.id, { status: C.STATUS.KW.PENDING });
    void reason;
    return 'paused';
  }

  /** مسح بيانات التصفح تلقائياً كل N كلمة مفحوصة (0 = معطّل) */
  async maybePeriodicClear(cfg) {
    const everyN = Math.max(0, parseInt(cfg && cfg.clearEveryN, 10) || 0);
    if (!everyN) { return; }
    const keywords = await state.getKeywords();
    const processed = keywords.filter((k) =>
      [C.STATUS.KW.DONE, C.STATUS.KW.FAILED, C.STATUS.KW.SKIPPED].includes(k.status)).length;
    const run = await state.getRun();
    const marker = run.clearMarker || 0;
    if (processed - marker >= everyN) {
      await logger.info('queue', `🧹 مسح دوري مع الاستراحة (كل ${everyN} كلمة) — بيانات التصفح اتسحت بعد ${processed} كلمة مفحوصة`);
      try { await chrome.browsingData.remove({ since: 0 }, { cacheStorage: true, cookies: true, history: true }); } catch (_) {}
      await state.setRun({ clearMarker: processed });
      await this.notify('🧹 مسح دوري مع الاستراحة', `مسحنا بيانات التصفح تلقائياً بعد ${processed} كلمة — الفحص مكمل لوحده.`);
    }
  }

  raceSerpOrCaptcha(tabId, cfg, signal) {
    // الانتظار على مقاس المسح «الواعي بالتقدّم»: السقف 60 ثانية + هامش، مش 20 + 8
    const timeout = Math.max(cfg.scanHardCapMs || 60000, cfg.maxWaitResultsMs || 20000) + 40000;
    return new Promise((resolve) => {
      let settled = false;
      let errorReloaded = false;
      let poller = null;
      const offs = [];
      const finish = (value) => {
        if (settled) { return; }
        settled = true;
        clearTimeout(timer);
        if (poller) { clearInterval(poller); }
        offs.forEach((off) => off());
        resolve(value);
      };
      const timer = setTimeout(() => finish({ type: 'timeout' }), timeout);
      if (signal) { signal.addEventListener('abort', () => finish({ type: 'aborted' }), { once: true }); }

      offs.push(bus.on(C.MSG.SERP_PARSED, (m) => {
        if (m.tabId === tabId) { finish({ type: 'serp', payload: m }); }
      }));
      offs.push(bus.on(C.MSG.CAPTCHA_PRESENT, (m) => {
        if (m.tabId !== tabId) { return; }
        if (m.fetchBased) { return; } // جلب خلفي فقط — ليس كابتشا تفاعلية
        // تحقق من حالة التبويب الفعلية قبل دخول وضع الكابتشا (علاج الإنذارات الكاذبة)
        tabctl.getUrl(tabId).then((u) => {
          if (urlkit.isSorry(u) || m.textBased) {
            finish({ type: 'captcha', payload: m });
          } else {
            logger.warn('queue', 'إعلان كابتشا مُتجاهَل: التبويب على صفحة نتائج سليمة (' + (u || '?') + ')');
          }
        });
      }));
      // صفحات الخطأ: 403/404/429 → تاب جديد؛ وباقي الأخطاء → ريفرش أخير
      offs.push(bus.on(C.MSG.SERP_ERROR, (m) => {
        if (m.tabId !== tabId) { return; }
        if (m.needsNewTab) { finish({ type: 'newtab', payload: m }); return; }
        if (m.reload !== false || errorReloaded) { return; }
        errorReloaded = true;
        logger.warn('queue', `صفحة خطأ (${m.kind}) — ريفرش أخير من المحرك`);
        tabctl.reload(tabId);
      }));
      // جوجل قد يحوّل لـ /sorry/ قبل حقن سكربت الصفحة
      offs.push(tabctl.onUrlChange(tabId, (url) => {
        if (urlkit.isSorry(url)) { finish({ type: 'captcha', payload: { url } }); }
      }));
      offs.push(tabctl.onRemoved(tabId, () => finish({ type: 'timeout' })));

      // فحص حالة فوري (علاج سباق: الكابتشا سبقت تركيب المستمعين)
      tabctl.getUrl(tabId).then((u) => {
        if (urlkit.isSorry(u)) { finish({ type: 'captcha', payload: { url: u } }); }
      });

      // مسبار دوري: رابط + أخطاء شبكة
      poller = setInterval(async () => {
        const u = await tabctl.getUrl(tabId);
        if (urlkit.isSorry(u)) { finish({ type: 'captcha', payload: { url: u } }); return; }
        if (/chrome-error:|chrome:\/\/error/.test(u) && !errorReloaded) {
          errorReloaded = true;
          await logger.warn('queue', 'خطأ شبكة أثناء الانتظار — ريفرش تلقائي');
          await tabctl.reload(tabId);
        }
      }, 1200);
    });
  }

  waitSerp(tabId, timeoutMs, signal) {
    return new Promise((resolve) => {
      let settled = false;
      const offs = [];
      const finish = (value) => {
        if (settled) { return; }
        settled = true;
        clearTimeout(timer);
        offs.forEach((off) => off());
        resolve(value);
      };
      const timer = setTimeout(() => finish(null), timeoutMs);
      if (signal) { signal.addEventListener('abort', () => finish(null), { once: true }); }
      offs.push(bus.on(C.MSG.SERP_PARSED, (m) => {
        if (m.tabId === tabId) { finish(m); }
      }));
      offs.push(tabctl.onRemoved(tabId, () => finish(null)));
    });
  }

  async handleCaptcha(tabId, kw, cfg, signal, allowPause = false) {
    const since = Date.now();
    await state.setRun({ status: C.STATUS.RUN.CAPTCHA, captcha: { tabId, attempts: 0, since } });
    await state.updateKeyword(kw.id, { status: C.STATUS.KW.CAPTCHA });
    this.broadcast();

    // عدّاد محاولات حي في البانر: نقرأ من المنسّق مباشرة كل 1.2 ثانية
    let lastAttempts = 0;
    const attemptsTicker = setInterval(async () => {
      const a = this.orchestrator.attempts(tabId);
      if (a !== lastAttempts) {
        lastAttempts = a;
        await state.setRun({ captcha: { tabId, attempts: a, since } });
        this.broadcast();
      }
    }, 1200);

    let result;
    try {
      result = await this.orchestrator.solve(tabId, cfg, signal);
    } finally {
      clearInterval(attemptsTicker);
    }
    if (signal && signal.aborted) { return 'paused'; }

    if (result.outcome === 'solved') {
      const run = await state.getRun();
      await state.setRun({
        status: C.STATUS.RUN.RUNNING,
        captcha: null,
        captchaSolves: (run.captchaSolves || 0) + 1
      });
      this.broadcast();
      // 😴 تهدئة قصيرة بعد الحل قبل ما نكمل: الرجوع الفوري لجوجل بعد كابتشا
      // بيجيب صفعة جديدة — بس من غير استنا طويلة زي الأول (8–14 ثانية كفاية)
      const cool = 8000 + Math.floor(Math.random() * 6000);
      await logger.info('captcha', `كابتشا اتحلت — تهدئة ${Math.round(cool / 1000)} ثانية قبل متابعة الفحص`);
      await sleep(cool, signal);
      if (signal && signal.aborted) { return 'paused'; }
      return 'solved';
    }

    if (result.outcome === 'no-buster') {
      await logger.warn('captcha', 'زر Buster لم يظهر في إطار التحدي — الانتقال للخطة الاحتياطية (مسح بيانات + تبويب جديد) بدون أي تدخل يدوي.');
    }

    // فشل: إيقاف مؤقت للتنبيه أو تخطٍّ أو ريفرش ومحاولة جديدة
    if (cfg.pauseOnCaptchaFail && allowPause) {
      await state.setRun({
        status: C.STATUS.RUN.PAUSED,
        pauseReason: 'captcha-failed',
        captcha: { tabId, attempts: result.attempts, since: Date.now(), lastError: result.outcome }
      });
      await logger.warn('queue', `فشل حل الكابتشا بعد ${result.attempts} محاولات — إيقاف مؤقت (اختياري من الإعدادات). الحل اليدوي يستأنف تلقائياً، أو اضغط استئناف للتخطي.`);
      await this.notify('فشل حل الكابتشا', `تعذر حل الكابتشا للكلمة: ${kw.keyword}. حلها يدوياً أو اضغط استئناف/تخطي من اللوحة.`);
      // مفيش شد فوكس للنافذة — الإشعار جوه اللوحة وزر «روحت للتبويب» اختياريين

      if (cfg.autoResumeOnManualSolve) {
        // راقب الحل اليدوي: تغيّر الرابط بعيداً عن /sorry/
        const manual = await this.waitManualSolve(tabId, cfg, signal);
        if (manual === 'solved') {
          await state.setRun({ status: C.STATUS.RUN.RUNNING, pauseReason: null, captcha: null });
          await logger.info('queue', 'تم الحل يدوياً — استئناف تلقائي');
          return 'solved';
        }
        if (manual === 'aborted') { return 'paused'; }
        return 'paused';
      }
      return 'paused';
    }

    // وضع تلقائي بالكامل: مفيش إيقاف مؤقت — نرجع الحالة «شغال» فوراً والخطة الاحتياطية
    // (مسح بيانات + تبويب جديد) بتتولى الكلمة تلقائياً من غير ما البانر يعلق أبداً
    await state.setRun({ status: C.STATUS.RUN.RUNNING, captcha: null });
    this.broadcast();
    await logger.warn('queue', `الكلمة "${kw.keyword}" فشل حلها التلقائي — الخطة الاحتياطية (مسح بيانات + تبويب جديد) بتتولى تلقائياً`);
    return 'failed';
  }

  /** بعد حل الكابتشا: خدي نفس طويل للتبويب — أول حاجة آخر تحليل مخزّن (ممكن
   *  يكون وصل قبل ما نفتح الاستماع)، وبعدها استرخاء هادي. مفيش مسح بيانات
   *  قبل ما نتأكد إن مفيش فعلًا نتيجة جاية. */
  async collectAfterSolve(tabId, sinceTs, signal) {
    await sleep(6000, signal);
    const cached = this.lastSerp && this.lastSerp.get(tabId);
    if (cached && cached.ts >= sinceTs) { return cached.payload; }
    const fresh = await this.waitSerp(tabId, C.LIMITS.SERP_AFTER_CAPTCHA_MS, signal);
    if (!fresh) {
      const late = this.lastSerp && this.lastSerp.get(tabId);
      if (late && late.ts >= sinceTs) { return late.payload; }
    }
    return fresh || null;
  }

  /** ضمان تاب واحد: نقفل كل تابانين فتحتهم الأداة (حتى من جلسات قبل إعادة تشغيل
   *  الـWorker) ونسيب النشط بس — بنمسحهم من القائمة المحفوظة ومن الذاكرة */
  async sweepExtraTabs(keepTabId) {
    const ids = new Set(this.ownedTabs || []);
    try {
      const run = await state.getRun();
      for (const id of (run.ownedTabIds || [])) { ids.add(id); }
    } catch (_) {}
    for (const stale of ids) {
      if (stale === keepTabId || !stale) { continue; }
      try { await chrome.tabs.remove(stale); } catch (_) {}
      if (this.ownedTabs) { this.ownedTabs.delete(stale); }
    }
    try { await state.setRun({ ownedTabIds: [keepTabId] }); } catch (_) {}
  }

  waitManualSolve(tabId, cfg, signal) {
    void cfg;
    return new Promise((resolve) => {
      let settled = false;
      const offs = [];
      const finish = (v) => {
        if (settled) { return; }
        settled = true;
        offs.forEach((off) => off());
        resolve(v);
      };
      offs.push(tabctl.onUrlChange(tabId, (url) => {
        if (!urlkit.isSorry(url)) { finish('solved'); }
      }));
      offs.push(bus.on(C.MSG.CAPTCHA_CHECKED, (m) => {
        if (m.tabId === tabId) { finish('solved'); }
      }));
      offs.push(tabctl.onRemoved(tabId, () => finish('tab-closed')));
      if (signal) { signal.addEventListener('abort', () => finish('aborted'), { once: true }); }
    });
  }

  /**
   * لا ترقيم صفحات: نبقى في الصفحة الأولى دائماً.
   * الأداة المساعدة تمدّ الصفحة إلى 100 نتيجة، وserp.js ينتظر دفعاتها ويخرج مبكراً.
   */
  /** كتابة عمود الترتيب في الشيت عبر واجهته (مربع الاسم + لصق TSV)
   *  بترتيب الشيت نفسه: بنقرأ عمود الكلمات من شيتك وبنكتب كل ترتيب
   *  قصاد نفس كلمته في صفه — مهما كان ترتيبه مختلف عن ترتيبنا. */
  async writeResultsToSheet() {
    const cfg = await state.getConfig();
    if (!cfg.sheetUrl) { return { ok: false, reason: 'no-sheet-url' }; }
    const keywords = await state.getKeywords();
    const results = await state.getResults();
    const normKey = (k) => normalizeArabic(String(k || '').trim().toLowerCase());
    const latest = new Map();
    for (const r of results) {
      const nk = normKey(r.keyword);
      if (!latest.has(nk)) { latest.set(nk, r); }
    }
    const posStr = (r) => {
      // نفس قواعد النسخ بالظبط: «1ai»/«4»/«ai»، والكلمة اللي ملهاش بوزيشن
      // (أو لسه متفحصتش) بتاخد شرطة «—» — عشان الشيت ما يبينش فراغات ملغزة
      if (!r) { return '—'; }
      if (r.found) {
        const pos = Number(r.position);
        const okPos = r.position != null && Number.isFinite(pos);
        return okPos ? (r.aiFound ? pos + 'ai' : String(pos)) : (r.aiFound ? 'ai' : '—');
      }
      return r.aiFound ? 'ai' : '—';
    };

    // 1) اقرأ ترتيب الكلمات في شيتك نفسه (gviz CSV — شيت مشارك برابط)
    let sheetOrder = null;
    try {
      const csvUrl = csvkit.sheetCsvUrl(cfg.sheetUrl);
      if (csvUrl) {
        const resp = await fetch(csvUrl, { credentials: 'omit' });
        if (resp.ok) {
          const text = await resp.text();
          if (!text.trim().startsWith('<')) {
            const order = csvkit.extractKeywords(csvkit.parseRows(text));
            if (order && order.length) { sheetOrder = order; }
          }
        }
      }
    } catch (_) { sheetOrder = null; }

    let lines;
    let aligned = false;
    if (sheetOrder) {
      // كل ترتيب قصاد نفس كلمته في صفه بترتيب شيتك
      lines = sheetOrder.map((kw) => posStr(latest.get(normKey(kw))));
      aligned = true;
    } else {
      lines = keywords.map((k) => posStr(latest.get(normKey(k.keyword))));
    }
    const tsv = lines.join('\n');
    // لو مفيش ولا نتيجة لسه (كل الصفوف شرطات بس) — ما نملّش الشيت فراغات
    if (!tsv.trim() || !lines.some((l) => l !== '—')) { return { ok: false, reason: 'nothing-to-write' }; }

    let tab = null;
    try {
      const all = await chrome.tabs.query({});
      tab = all.find((t) => (t.url || '').indexOf('docs.google.com/spreadsheets') !== -1);
      // الشيت بتاعك يتفتح في نافذتك الحالية — مش في نافذة الأداة الخلفية
      if (!tab) { tab = await tabctl.open(cfg.sheetUrl, { foregroundTab: true, useToolWindow: false }); }
    } catch (_) { return { ok: false, reason: 'tab-error' }; }
    await tabctl.waitForComplete(tab.id, C.LIMITS.TAB_LOAD_TIMEOUT_MS);
    await scheduler.wait(4000, 'sheet-settle');
    let resp = null;
    try {
      resp = await chrome.tabs.sendMessage(tab.id, { type: C.MSG.SHEET_CMD_WRITE, tsv: tsv, startCell: cfg.sheetStartCell || 'B1' });
    } catch (_) { resp = null; }
    if (resp && resp.ok) {
      const how = aligned ? 'قصاد كل كلمة في صفها بترتيب شيتك ✔' : `عند ${cfg.sheetStartCell || 'B1'} بترتيب الإضافة (تعذرت قراءة ترتيب الشيت)`;
      await logger.info('queue', `📝 كُتب عمود الترتيب في الشيت — ${how}`);
    } else {
      await this.notify('⚠️ الشيت', 'تعذرت الكتابة التلقائية — استخدم زر نسخ للصق');
      await logger.warn('queue', `⚠ تعذرت الكتابة التلقائية في الشيت (${resp && resp.reason ? resp.reason : 'no-response'}) — استخدم زر "نسخ للصق في الشيت"`);
    }
    return resp || { ok: false, reason: 'no-response' };
  }

  /** مزامنة الكلمات من شيت جوجل (نقطة تصدير CSV العامة — بدون API) */
  /** بعد كل المحاولات (ريفرش + تاب جديد): الكلمة تتسجل كغير موجود — مفيش تخطي أبداً */
  async recordExhausted(kw, cfg) {
    return this.recordResult(kw, {
      items: [], aiItems: [], aiText: '', total: 0, noResults: true, adsCount: 0, serpUrl: ''
    }, cfg, 'retries-exhausted');
  }

  async recordResult(kw, serp, cfg, via) {
    const match = matchResults(serp.items || [], cfg);
    // الترتيب الرسمي: الرقم الأخضر بتاع Serp Counter جنب النتيجة إن موجود
    if (match.found && match.matched && match.matched.counterPos) {
      match.position = match.matched.counterPos;
      match.viaCounter = true;
    }
    let aiMatch = (serp.aiItems && serp.aiItems.length) ? matchResults(serp.aiItems, cfg) : { found: false, position: null, matched: null };
    if (!aiMatch.found && serp.aiText) {
      // صارم: «AI» يتكتب بس لو الموقع مذكور فعلاً جوه نص الـ AI Overview —
      // تطابق مباشر للاسم الكامل أو الدومين، بدون المطابقات المرنة اللي كانت بتعطي نتايج كاذبة
      const hay = String(serp.aiText).toLowerCase();
      const hayN = normalizeArabic(serp.aiText);
      const dom = String(cfg.storeDomain || '').trim().toLowerCase();
      const label = dom ? dom.split('.')[0] : '';
      const domHit = !!(dom && hay.includes(dom)) || !!(label && label.length >= 6 && hay.includes(label));
      const nameHit = [cfg.storeName, cfg.storeNameEn]
        .map((x) => normalizeArabic(x || ''))
        .some((n) => n.length >= 3 && hayN.includes(n));
      if (nameHit || domHit) {
        aiMatch = { found: true, position: null, matched: { title: 'AI mention', url: null }, reasons: ['ai-text'] };
      }
    }
    const row = {
      id: 'res_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
      keywordId: kw.id,
      keyword: kw.keyword,
      found: match.found,
      position: match.position,
      aiFound: aiMatch.found,
      aiPosition: aiMatch.position,
      early: !!serp.early,
      // الرابط زي ما جوجل كاتبه في الصفحة بالظبط (سطر الـ cite كامل)
      url: (match.matched && match.matched.url)
        ? match.matched.url
        : ((serp.items || [])[match.position - 1] || {}).url || ((aiMatch.matched && aiMatch.matched.url) || null),
      clickUrl: (match.matched && (match.matched.click || match.matched.url))
        || ((serp.items || [])[match.position - 1] || {}).click || '',
      urlDisplay: (match.matched && (match.matched.display || match.matched.url))
        || ((serp.items || [])[match.position - 1] || {}).display
        || ((aiMatch.matched && (aiMatch.matched.display || aiMatch.matched.url)) || ''),
      title: match.matched ? match.matched.title : (aiMatch.matched ? aiMatch.matched.title : null),
      total: serp.total || (serp.items || []).length,
      aiTotal: (serp.aiItems || []).length,
      adsCount: serp.adsCount || 0,
      noResults: !!serp.noResults,
      topHosts: (serp.items || []).slice(0, 6).map((i) => i.host),
      via: via,
      serpUrl: serp.serpUrl || '',
      checkedAt: Date.now()
    };
    // فحص النتائج المحلية (خرائط) اختياري — مثل خطوة السيناريو اليدوي
    if (cfg.mapsCheck) {
      const loc = await localCheck(kw.keyword, cfg);
      if (loc) {
        row.localFound = loc.found;
        row.localPosition = loc.position;
        if (loc.found) {
          await logger.info('queue', `🗺 "${kw.keyword}" → محلياً (خرائط) #${loc.position}`);
        }
      }
    }

    await state.addResult(row);
    await state.bumpDailyCount();

    const updated = await state.updateKeyword(kw.id, {
      status: C.STATUS.KW.DONE,
      lastPosition: match.position,
      lastFound: match.found,
      lastAiPosition: aiMatch.found ? aiMatch.position : null,
      lastAiFound: !!aiMatch.found,
      lastCheckedAt: Date.now(),
      history: ((kw.history || []).concat([{
        position: match.position,
        aiPosition: aiMatch.found ? aiMatch.position : null,
        found: match.found,
        aiFound: aiMatch.found,
        ts: Date.now()
      }])).slice(-(cfg.maxHistoryPerKeyword || 40))
    });

    const run = await state.getRun();
    await state.setRun({
      checked: (run.checked || 0) + 1,
      found: (run.found || 0) + (match.found ? 1 : 0)
    });

    if (match.found) {
      await logger.info('queue', `✅ "${kw.keyword}" → الترتيب #${match.position} من ${match.scanned} نتيجة (${match.reasons.join('+')})${match.viaCounter ? ' — وفق رقم Serp Counter ✔' : ''}${serp.early ? ' — خروج مبكر ✔' : ''}`);
    } else if (aiMatch.found) {
      await logger.info('queue', `🤖 "${kw.keyword}" → ظهر في AI Overview ${aiMatch.position ? 'باستشهاد #' + aiMatch.position : 'باسم الموقع نصياً'} (غير موجود عضوياً ضمن ${match.scanned})`);
    } else {
      await logger.warn('queue', `⚠️ "${kw.keyword}" → غير موجود ضمن ${match.scanned} نتيجة ولا في AI Overview`);
      await logger.info('queue', `🔎 تشخيص — أول النطاقات المقروءة: ${row.topHosts.join(' | ') || '(لا شيء)'} | إعدادك: ${cfg.storeDomain || '-'} / ${cfg.storeName || '-'} / ${cfg.storeNameEn || '-'}`);
    }
    this.broadcast();
    void updated;

    // التبويب العامل يبقى حياً للكلمة التالية (reuse tab)
    return 'done';
  }
}
