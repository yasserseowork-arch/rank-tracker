/**
 * captcha-orchestrator.js — منسّق حل الكابتشا (الإصدار State-Based)
 *
 * الفلسفة الجديدة: لا نعتمد على حدث واحد قد يُفوّت، بل:
 *  - فحص حالة مباشر: رابط التبويب + CAPTCHA_CMD_PROBE لكل الإطارات.
 *  - إطار التحدي (bframe) يقود نفسه ذاتياً (Buster → فشل → ⟳ → Buster).
 *  - دور المنسّق: انتظار إشارات الحل، مراقبة عدد المحاولات، والتدخل الاحتياطي
 *    بأمر CAPTCHA_CMD_NEXT إن لم يستجب إطار Buster.
 *
 * إشارات الحل (بالأولوية):
 *  1) تغيّر رابط التبويب بعيداً عن /sorry/
 *  2) CAPTCHA_CHECKED من إطار الـ anchor
 *  3) CAPTCHA_CHALLENGE_CLOSED + تأكيد بالرابط
 */
import { C } from './bridge.js';
import { bus } from './bus.js';
import * as logger from './logger.js';
import * as tabctl from './tabctl.js';
import { sleep } from './rand.js';

export class CaptchaOrchestrator {
  constructor() {
    this.active = null; // {tabId, attempts, startedAt}
    this.lastAttemptTs = new Map(); // tabId → آخر محاولة مسجلة (Buster أو المحرك المدمج)
    this.lastBusterSeenTs = new Map(); // tabId → آخر مرة شاف أي إطار زر Buster
    bus.on(C.MSG.CAPTCHA_ATTEMPT, (m) => {
      if (m && m.tabId) { this.lastAttemptTs.set(m.tabId, Date.now()); }
    });
    bus.on(C.MSG.CAPTCHA_BUSTER_SEEN, (m) => {
      if (m && m.tabId) { this.lastBusterSeenTs.set(m.tabId, Date.now()); }
    });
  }

  /** أمر لكل إطارات التبويب — أول رد يصل يكفي، ولو مفيش رد خلال 3 ثوانٍ بنرجع null
   *  (command to all tab frames — first reply suffices; timeout guard so we never hang) */
  async command(tabId, type, payload) {
    try {
      return await Promise.race([
        chrome.tabs.sendMessage(tabId, Object.assign({ type }, payload || {})),
        new Promise((resolve) => setTimeout(() => resolve(null), 3000))
      ]);
    } catch (err) {
      await logger.debug('captcha', `تعذر إرسال أمر للتبويب ${tabId}: ${err && err.message}`);
      return null;
    }
  }

  async probe(tabId) {
    const resp = await this.command(tabId, C.MSG.CAPTCHA_CMD_PROBE);
    if (resp && resp.busterFound === true) { this.lastBusterSeenTs.set(tabId, Date.now()); }
    return resp;
  }

  /** هل زر Buster مرصود حالياً في أي مستند حول التبويب؟ */
  busterSeen(tabId, windowMs) {
    const ts = this.lastBusterSeenTs.get(tabId) || 0;
    return ts > 0 && Date.now() - ts < (windowMs || 4000);
  }

  /** حالة التبويب الآن: هل نحن على صفحة كابتشا؟ (tab state right now: are we on a captcha page?) */
  async isCaptchaPage(tabId) {
    const url = await tabctl.getUrl(tabId);
    return /\/sorry\//.test(url);
  }

  /**
   * دورة الحل كاملة.
   * @returns {Promise<{outcome:'solved'|'failed'|'no-buster'|'aborted', attempts:number, detail?:string}>}
   */
  async solve(tabId, cfg, signal) {
    const max = Math.max(1, cfg.captchaMaxAttempts || 2);
    // مهلة الجولة لازم تستوعب دورة الآلة الذاتية كاملة:
    // ظهور الصوت (~12ث) + نسخ الصوت (~60ث كحد أقصى أول مرة) + الحكم (~5ث)
    const attemptTimeout = Math.max(cfg.captchaAttemptTimeoutMs || 0, 90000);
    this.active = { tabId, attempts: 0, startedAt: Date.now() };

    await logger.warn('captcha', `كابتشا مرصودة (تبويب ${tabId}) — الآلة الذاتية بتنسخ الصوت وتحل، والمنسّق يراقب (حتى ${max} محاولات)`);

    // تأكد إن التحدي فاتح أصلاً (الآلة الذاتية هي اللي بتحل — مش لازم زر Buster)
    let probe = await this.probe(tabId);
    const solverActive = (p) => !!(p && (p.busterFound === true || p.challengeOpen === true || p.audioOpen === true || p.imageOpen === true));
    if (!solverActive(probe)) {
      await logger.warn('captcha', 'التحدي لسه مفتحش — انتظار حتى 12 ثانية…');
      const grace = await this.waitChallenge(tabId, 12000);
      if (!grace) {
        // لو الصفحة سابت /sorry/ يبقى حُلّت قبل ما التحدي يفتح أصلاً
        const u0 = await tabctl.getUrl(tabId);
        this.active = null;
        if (u0 && !/\/sorry\//.test(u0)) {
          return { outcome: 'solved', attempts: 0, detail: 'solved-before-challenge' };
        }
        return { outcome: 'no-buster', attempts: 0, detail: 'challenge-not-open' };
      }
      probe = grace;
    }

    let failedReport = null;
    const offFail = bus.on(C.MSG.CAPTCHA_FAILED, (m) => {
      if (m && m.tabId === tabId) { failedReport = m; }
    });

    try {
      for (let round = 1; round <= max; round++) {
        if (signal && signal.aborted) { offFail(); this.active = null; return { outcome: 'aborted', attempts: round - 1 }; }
        const roundStart = Date.now();
        this.active.attempts = round;
        await logger.info('captcha', `جولة انتظار الحل ${round}/${max} — الآلة الذاتية شغالة…`);

        const solved = await this.waitSolved(tabId, attemptTimeout, signal);
        if (solved) {
          await logger.info('captcha', `تم حل الكابتشا عند الجولة ${round} ✔`);
          return { outcome: 'solved', attempts: round };
        }
        if (failedReport) {
          await logger.warn('captcha', `إطار التحدي خلّص محاولاته (${failedReport.attempts || round}) — بنسلّم للخطة الاحتياطية: مسح بيانات + تبويب جديد لنفس الكلمة`);
          return { outcome: 'failed', attempts: failedReport.attempts || round };
        }

        // الآلة عملت محاولة حقيقية جوه الجولة دي؟ هي بتقود — جولة إضافية من غير أي تدخل
        const lastAtt2 = this.lastAttemptTs.get(tabId) || 0;
        if (lastAtt2 >= roundStart - 500) {
          await logger.info('captcha', '🟠 محاولة حل نشطة من الإطار — جولة انتظار إضافية بدون أي تدخل');
          continue;
        }

        // مفيش أي نشاط (تحمّل ناقص أو تحدّي مات) — استحثاث تحدٍّ جديد والآلة هتكمّل
        await logger.warn('captcha', 'لا استجابة من إطار التحدي — استحثاث تحدي جديد');
        await this.command(tabId, C.MSG.CAPTCHA_CMD_NEXT);
        await sleep(cfg.captchaGapMs || 2500, signal);
      }
      // فحص أخير: ربما اكتمل الحل لحظة انتهاء آخر جولة انتظار
      const finalUrl = await tabctl.getUrl(tabId);
      if (finalUrl && !/\/sorry\//.test(finalUrl)) {
        await logger.info('captcha', 'الحل اكتمل لحظة انتهاء المهلات — الصفحة تابعت للنتائج ✔');
        return { outcome: 'solved', attempts: max };
      }
      return { outcome: 'failed', attempts: max };
    } finally {
      offFail();
      this.active = null;
    }
  }

  /** انتظار فتح التحدي (صوتي/صوري/زر Buster) عبر probe دوري (waiting for the challenge to open (periodic probe)) */
  async waitChallenge(tabId, timeoutMs) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const probe = await this.probe(tabId);
      if (probe && (probe.busterFound === true || probe.challengeOpen === true || probe.audioOpen === true || probe.imageOpen === true)) {
        if (probe.busterFound === true) { this.lastBusterSeenTs.set(tabId, Date.now()); }
        return probe;
      }
      await sleep(800);
    }
    return null;
  }

  /** انتظار ظهور زر Buster (probe دوري) (waiting for Buster button to appear (periodic probe)) */
  async waitBuster(tabId, timeoutMs) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const probe = await this.probe(tabId);
      if (probe && probe.busterFound === true) { return probe; }
      await sleep(800);
    }
    return null;
  }

  /** انتظار إشارات الحل ضمن مهلة الجولة الواحدة (waiting for solve signals within a single round's timeout) */
  async waitSolved(tabId, timeoutMs, signal) {
    return new Promise((resolve) => {
      let settled = false;
      const offs = [];
      const finish = (value) => {
        if (settled) { return; }
        settled = true;
        clearTimeout(timer);
        clearInterval(poller);
        offs.forEach((off) => off());
        resolve(value);
      };

      const timer = setTimeout(() => finish(false), timeoutMs);
      if (signal) { signal.addEventListener('abort', () => finish(false), { once: true }); }

      // 1) تغيّر الرابط بعيداً عن /sorry/ (polling + event معاً) (URL change away from /sorry/ (polling + event together))
      offs.push(tabctl.onUrlChange(tabId, (url) => {
        if (!/\/sorry\//.test(url)) { finish(true); }
      }));
      const poller = setInterval(async () => {
        const url = await tabctl.getUrl(tabId);
        if (url && !/\/sorry\//.test(url)) { finish(true); }
      }, 1500);

      // 2) checkbox تم التحقق منه (checkbox has been verified)
      offs.push(bus.on(C.MSG.CAPTCHA_CHECKED, (m) => {
        if (m && m.tabId === tabId) { finish(true); }
      }));

      // 3) إغلاق التحدي الصوتي → تأكيد بالرابط بعد لحظة (audio challenge closed → confirm via URL after a moment)
      offs.push(bus.on(C.MSG.CAPTCHA_CHALLENGE_CLOSED, (m) => {
        if (m && m.tabId !== tabId) { return; }
        setTimeout(async () => {
          const url = await tabctl.getUrl(tabId);
          if (url && !/\/sorry\//.test(url)) { finish(true); }
        }, 3500);
      }));

      // 4) إغلاق التبويب = فشل (tab closed = failure)
      offs.push(tabctl.onRemoved(tabId, () => finish(false)));

      // 5) الآلة الذاتية أعلنت استنفاد المحاولات → انتهى فوراً (self-solving machine announced exhausted attempts → finish now)
      offs.push(bus.on(C.MSG.CAPTCHA_FAILED, (m) => {
        if (m && m.tabId === tabId) { finish(false); }
      }));
    });
  }

  isActive(tabId) {
    return !!this.active && this.active.tabId === tabId;
  }

  attempts(tabId) {
    return this.isActive(tabId) ? this.active.attempts : 0;
  }
}
