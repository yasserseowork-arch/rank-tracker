/**
 * constants.js — الثوابت المشتركة (Classic script)
 * يُحقن هذا الملف قبل كل content script وكذلك يُحمّل كلاسيكياً في صفحات الإضافة،
 * لذلك يجب ألا يحتوي على أي صيغة ES modules (لا import / export).
 *
 * Shared constants injected into every content script world and loaded as a
 * classic script inside extension pages. Must stay module-free.
 */
(function (global) {
  'use strict';

  /** أنواع الرسائل بين Service Worker و Content Scripts و Side Panel */
  const MSG = {
    // عامة
    PING: 'srt/ping',
    GET_CONFIG: 'srt/config/get',
    SET_CONFIG: 'srt/config/set',
    GET_STATE: 'srt/state/get',
    STATE_BROADCAST: 'srt/state/broadcast',
    LOG: 'srt/log',
    KEEPALIVE: 'srt/keepalive',

    // الطابور
    QUEUE_START: 'srt/queue/start',
    QUEUE_PAUSE: 'srt/queue/pause',
    QUEUE_RESUME: 'srt/queue/resume',
    QUEUE_STOP: 'srt/queue/stop',

    // الكلمات المفتاحية
    KEYWORDS_SET: 'srt/keywords/set',
    KEYWORDS_ADD: 'srt/keywords/add',
    KEYWORDS_REMOVE: 'srt/keywords/remove',
    KEYWORDS_CLEAR: 'srt/keywords/clear',

    // النتائج
    RESULTS_CLEAR: 'srt/results/clear',

    // SERP
    SERP_STARTED: 'srt/serp/started',
    SERP_PARSED: 'srt/serp/parsed',
    SERP_ERROR: 'srt/serp/error',
    SERP_FETCH_BLOCKED: 'srt/serp/fetch-blocked',
    SERP_CMD_SEARCH: 'srt/serp/cmd/search',
    SERP_CMD_STATE: 'srt/serp/cmd/state',
    SHEET_CMD_WRITE: 'srt/sheet/cmd/write',
    SHEETS_WRITE_NOW: 'srt/sheet/write-now',

    // الكابتشا
    CAPTCHA_PRESENT: 'srt/captcha/present',
    CAPTCHA_CHECKED: 'srt/captcha/checked',
    CAPTCHA_ATTEMPT: 'srt/captcha/attempt',
    CAPTCHA_ERROR: 'srt/captcha/error',
    CAPTCHA_CHALLENGE_CLOSED: 'srt/captcha/challenge-closed',
    CAPTCHA_BUSTER_NOT_FOUND: 'srt/captcha/buster-not-found',
    CAPTCHA_BUSTER_SEEN: 'srt/captcha/buster-seen',
    CAPTCHA_COORD_CLICK: 'srt/captcha/coord-click',
    CAPTCHA_VERIFY_CLICK: 'srt/captcha/verify-click',
    CAPTCHA_SOLVED: 'srt/captcha/solved',
    CAPTCHA_FAILED: 'srt/captcha/failed',
    CAPTCHA_CMD_NEXT: 'srt/captcha/cmd/next',
    CAPTCHA_CMD_STOP: 'srt/captcha/cmd/stop',
    CAPTCHA_CMD_PROBE: 'srt/captcha/cmd/probe'
  };

  /** حالات محرك الطابور وحالات الكلمة المفتاحية */
  const STATUS = {
    RUN: {
      IDLE: 'idle',
      RUNNING: 'running',
      PAUSED: 'paused',
      CAPTCHA: 'captcha',
      STOPPED: 'stopped'
    },
    KW: {
      PENDING: 'pending',
      RUNNING: 'running',
      DONE: 'done',
      CAPTCHA: 'captcha',
      FAILED: 'failed',
      SKIPPED: 'skipped'
    }
  };

  /**
   * محددات DOM لصفحة نتائج جوجل (SERP).
   * جوجل تغيّر البنية بين فترة وأخرى، لذلك نعتمد قوائم محددات مع بدائل تراجع.
   */
  const SEL = {
    serp: {
      containers: ['#search .g', '#rso .g', '#search div[data-hveid] > div.g', 'div.g'],
      link: 'a[href^="http"]',
      title: 'h3',
      snippet: '.VwiC3b, [data-sncf="1"], [data-sncf="2"], .IsZvec, .MUxGbd',
      adsRoot: ['#tads', '#tadsb', '#bads', '.ads-visurl', '[data-text-ad]', '#topads'],
      noResults: ['#search .card-section', '#topstuff .medicv2c2f', 'div[data-async-type="no_results"]'],
      ai: ['ai-overview', '#aiOverview', '[data-attrid="aiOverview"]', '[data-async-type="aiOverview"]', '.KsK2d', '.w34xwb', '.YhCVmd', 'div[jsname="VZbeH"]'],
      paa: ['.related-question-pair', 'div[jsname="CpkPjb"]', '.g:not([data-hveid]) .related-question-pair']
    },
    recaptcha: {
      anchor: '#recaptcha-anchor',
      checkbox: ['#recaptcha-anchor', '.recaptcha-checkbox'],
      checkboxChecked: '.recaptcha-checkbox-checked',
      ariaChecked: '#recaptcha-anchor[aria-checked="true"]',
      imageChallenge: ['.rc-imagechallenge', '#recaptcha-imagechallenge'],
      audioSwitch: ['#recaptcha-audio-button', 'button[title*="audio" i]', 'button[aria-label*="audio" i]'],
      reload: ['#recaptcha-reload-button', '.rc-button-reload', 'button[title*="new challenge" i]', 'button[aria-label*="new challenge" i]'],
      play: ['#recaptcha-play-button', '.rc-audiochallenge-play-button button', '.rc-button-audio-play'],
      audioInput: ['#audio-response', '#audio-input', 'input#audio-response'],
      verify: ['#recaptcha-verify-button', '.rc-button-recaptcha-verify'],
      audioError: ['.rc-audiochallenge-error-message', '.rc-audiochallenge-error'],
      audioChallenge: ['.rc-audiochallenge', '#recaptcha-verify-audio-button', '.rc-audiochallenge-tdownload-link']
    },
    /**
     * زر إضافة Buster (الشخص البرتقالي) المحقون داخل iframe الخاص بـ reCAPTCHA.
     * لا يمكننا معرفة معرف الإضافة مسبقاً، لذلك نكتشف أي صورة/إطار مصدره
     * chrome-extension:// لأنه لا يوجد مصدر مشروع آخر داخل إطار reCAPTCHA.
     */
    buster: [
      'img[src^="chrome-extension://mpbjkejclgfgadiemmefgebjfooflfhl"]',
      'img[src^="chrome-extension://"]',
      'iframe[src^="chrome-extension://"]',
      '[id*="buster" i]',
      '[class*="buster" i]',
      'button[aria-label*="buster" i]',
      'button[title*="buster" i]'
    ],
    consent: [
      'form[action*="consent"] button[type="submit"]',
      '#L2AGLb',
      'button[aria-label*="Accept" i]',
      'button[aria-label*="أوافق" i]',
      '.QS5gu.fbNe3b'
    ],
    consentTexts: ['accept all', 'i agree', 'agree', 'أوافق على كل شيء', 'قبول الكل', 'أوافق'],
    search: {
      box: ['textarea[name="q"]', 'input[name="q"]', 'textarea#APjFqb', 'input#APjFqb', '[name="q"]'],
      form: ['form[role="search"]', 'form[action="/search"]']
    }
  };

  /** حدود وقواعد عامة */
  const LIMITS = {
    MAX_RESULTS_STORED: 2000,
    MAX_LOGS: 400,
    MAX_HISTORY_PER_KEYWORD: 40,
    TAB_LOAD_TIMEOUT_MS: 45000,
    SERP_AFTER_CAPTCHA_MS: 60000,
    KEEPALIVE_INTERVAL_MS: 15000,
    HEARTBEAT_INTERVAL_MS: 20000
  };

  const VERSION = '1.19.0';

  global.SRT_C = { VERSION, MSG, STATUS, SEL, LIMITS };
})(globalThis);
