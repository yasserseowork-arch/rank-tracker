/**
 * scheduler.js — الإيقاع البشري والمهل
 *
 * مشكلة MV3: الـ Service Worker يُقتل بعد ~30 ثانية خمول.
 * الحل مزدوج:
 *  1) مهل قصيرة (<= 25 ث) عبر setTimeout طالما يوجد Keep-Alive متصل.
 *  2) مهل طويلة عبر chrome.alarms مع استئناف الحالة من storage.session
 *     إذا استيقظ الـ Worker من الصفر.
 */
import { humanDelay, sleep } from './rand.js';
import * as logger from './logger.js';

const alarmResolvers = new Map();
let keepaliveClients = 0;

export function registerKeepaliveClient(delta) {
  keepaliveClients = Math.max(0, keepaliveClients + delta);
  return keepaliveClients;
}

export function keepaliveCount() {
  return keepaliveClients;
}

/** انتظار ذكي: مؤقّت داخلي أو Alarm حسب المدة ووجود نبضة حية */
export async function wait(ms, tag, signal) {
  const duration = Math.max(0, ms);
  if (duration <= 25000 && keepaliveClients > 0) {
    return sleep(duration, signal);
  }
  if (duration <= 25000) {
    // لا يوجد عميل حي لكن المدة قصيرة: مؤقّت عادي مع أمل بقاء Worker
    return sleep(duration, signal);
  }
  return waitViaAlarm(duration, tag, signal);
}

function waitViaAlarm(ms, tag, signal) {
  const name = 'srt-wait-' + (tag || 'x') + '-' + Date.now().toString(36);
  return new Promise((resolve) => {
    const finish = (result) => {
      alarmResolvers.delete(name);
      try { chrome.alarms.clear(name); } catch (_) {}
      resolve(result);
    };
    alarmResolvers.set(name, finish);
    const minutes = Math.max(0.5, ms / 60000);
    try { chrome.alarms.create(name, { delayInMinutes: minutes }); } catch (_) {
      // بيئية بدون alarms: نوم عادي
      sleep(ms, signal).then(finish);
    }
    if (signal) {
      signal.addEventListener('abort', () => finish({ aborted: true }), { once: true });
    }
  });
}

export function resolveAlarm(name) {
  const resolver = alarmResolvers.get(name);
  if (resolver) { resolver({ aborted: false, alarm: true }); return true; }
  return false;
}

export function pendingAlarms() {
  return Array.from(alarmResolvers.keys());
}

/** المهلة التلقائية قبل كل كلمة: ~10 ثواني (قرار المستخدم) — v1.20.1
 *  العشر بالظبط المتكررة كل مرة بصمة آلية؛ بنحافظ على المتوسط ونجيب هامان 8.5–14 ثانية */
export async function preKeywordDelay(cfg, context, signal) {
  const ms = 8500 + Math.floor(Math.random() * 5500);
  await logger.info('scheduler', `مهلة قبل الكلمة #${(context && context.index || 0) + 1}: ${(ms / 1000).toFixed(1)}ث`);
  return wait(ms, 'predelay', signal);
}

/** استراحة طويلة كل N كلمات لمحاكاة جلسة بشرية حقيقية */
export async function cooldownIfNeeded(cfg, processedCount, signal, onBreakStart) {
  const every = cfg.cooldownEvery || 0;
  if (!every || processedCount <= 0 || processedCount % every !== 0) { return null; }
  const ms = humanDelay(cfg.cooldownMs || 45000, cfg.cooldownJitterMs || 0);
  await logger.info('scheduler', `استراحة دورية بعد ${processedCount} كلمة: ${(ms / 1000).toFixed(0)}ث`);
  if (onBreakStart) { try { await onBreakStart(ms); } catch (_) {} }
  return wait(ms, 'cooldown', signal);
}
