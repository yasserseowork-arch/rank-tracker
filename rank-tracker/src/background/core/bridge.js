/**
 * bridge.js — جسر بين عالم الـ Modules وعالم الـ Classic scripts.
 * ملفات src/lib/*.js كلاسيكية وتضع ثوابتها على globalThis.SRT_C،
 * لكن الـ Service Worker module لا يحمّلها، لذلك نعيد تصديرها من هنا.
 */
const fallback = {
  VERSION: '1.19.4',
  MSG: {
    PING: 'srt/ping',
    GET_CONFIG: 'srt/config/get',
    SET_CONFIG: 'srt/config/set',
    GET_STATE: 'srt/state/get',
    STATE_BROADCAST: 'srt/state/broadcast',
    LOG: 'srt/log',
    KEEPALIVE: 'srt/keepalive',
    QUEUE_START: 'srt/queue/start',
    QUEUE_PAUSE: 'srt/queue/pause',
    QUEUE_RESUME: 'srt/queue/resume',
    QUEUE_STOP: 'srt/queue/stop',
    KEYWORDS_SET: 'srt/keywords/set',
    KEYWORDS_ADD: 'srt/keywords/add',
    KEYWORDS_REMOVE: 'srt/keywords/remove',
    KEYWORDS_CLEAR: 'srt/keywords/clear',
    RESULTS_CLEAR: 'srt/results/clear',
    SERP_STARTED: 'srt/serp/started',
    SERP_PARSED: 'srt/serp/parsed',
    SERP_ERROR: 'srt/serp/error',
    SERP_FETCH_BLOCKED: 'srt/serp/fetch-blocked',
    SERP_CMD_SEARCH: 'srt/serp/cmd/search',
    SERP_CMD_STATE: 'srt/serp/cmd/state',
    SHEET_CMD_WRITE: 'srt/sheet/cmd/write',
    SHEETS_WRITE_NOW: 'srt/sheet/write-now',
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
  },
  STATUS: {
    RUN: { IDLE: 'idle', RUNNING: 'running', PAUSED: 'paused', CAPTCHA: 'captcha', STOPPED: 'stopped' },
    KW: { PENDING: 'pending', RUNNING: 'running', DONE: 'done', CAPTCHA: 'captcha', FAILED: 'failed', SKIPPED: 'skipped' }
  },
  LIMITS: {
    MAX_RESULTS_STORED: 2000,
    MAX_LOGS: 400,
    MAX_HISTORY_PER_KEYWORD: 40,
    TAB_LOAD_TIMEOUT_MS: 45000,
    SERP_AFTER_CAPTCHA_MS: 60000,
    KEEPALIVE_INTERVAL_MS: 15000,
    HEARTBEAT_INTERVAL_MS: 20000
  }
};

export const C = (globalThis.SRT_C && globalThis.SRT_C.MSG) ? globalThis.SRT_C : fallback;
