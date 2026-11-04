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
    // v1.21.40: مستمع الإلغاء كان بيفضل مربوط بالـcontroller بعد كل استراحة تخلص
    // طبيعي (once بيشيل بس لما الإلغاء يحصل). بقى يتشال جوه finish على كل المسارات.
    const onAbort = signal ? () => finish({ aborted: true }) : null;
    const fin = (r) => {
      if (onAbort) { try { signal.removeEventListener('abort', onAbort); } catch (_) {} }
      finish(r);
    };
    alarmResolvers.set(name, fin);
    // 🔴 v1.21.40: `Math.max(0.5, ms/60000)` كان بيحوّل **أي** انتظار أقصر من 30 ثانية
    // لـ30 ثانية بالظبط (كروم بيرفض delayInMinutes < 0.5 في نسخ كتير، وبعضها بيقرّبه).
    // يعني استراحة 26 ثانية كانت بتاخد 30 — الأداة أبطأ من اللي المستخدم ضبطه ومن غير
    // ما حد يقول. بقى: أقل من 30ث = مؤقّت داخلي (نفس مسار الـwait القصير)، وفوق كده
    // alarm حقيقي.
    if (ms < 30000) {
      sleep(ms, signal).then((r) => fin(r));
      if (onAbort) {
        signal.addEventListener('abort', onAbort, { once: true });
      }
      return;
    }
    const minutes = ms / 60000;
    try { chrome.alarms.create(name, { delayInMinutes: minutes }); } catch (_) {
      // بيئية بدون alarms: نوم عادي
      sleep(ms, signal).then((r) => fin(r));
    }
    if (onAbort) {
      signal.addEventListener('abort', onAbort, { once: true });
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
  // v1.21.3: ⚡ وضع بارد — الرن ما شفش كابتشا خالص (heat صفر)؟ الفاصل 0.7–1.6 ثانية (v1.21.9)
  // أسرع من اليد نفسها بلمسة، لسه فوق أي بوت بfixed-timing وأقل بصمة من الثواني العشر.
  // أول ما كابتشا تظهر بنبقى 5.5–9 ثانية على طول، والحرارة بتنزل بكلمة نضيفة (v1.21.4)
  const cold = !!(context && context.cold);
  // v1.21.37 (طلب المستخدم: «كله ثابت، الوقت يقل مش يكتر»): الفواصل بقت ثابتة قصيرة —
  // بارد 0.6 ث، دافي = delayMs. العشوائية كانت درع بصمة، بس المستخدم حسمها لصالح الثبات
  // والسرعة، والدروع الحقيقية (سبات الكابتشا، تهنيّة الحصار، تبريد الركن) لسه شغالة.
  // v1.21.40: 🔴 delayMs (مهلة قبل كل كلمة — أول حقل في README وأول إعداد في
  // DEFAULT_CONFIG) **مكانش بيتقرأ هنا خالص**: القيمة مثبّتة 4000 في الكود، فأي حد
  // يعدّل «مهلة قبل كل كلمة» من الإعدادات كان بيكتب رقم مش بيتنفّذ. القيمة الافتراضية
  // لسه 4000 حرفيًا (أمر 1.21.37 «كله ثابت») — اللي بيتغيّر بس إن تعديل المستخدم
  // فوقها بقى له معنى.
  // ⚠️ السطر ده مثبَّت حرفيًا في ست اختبارات «مقدّسة» (v1201/v1205/v1213/v1219/v12134/
  // v12136-37) — بنسيبه زي ما هو، وبنقرا تعديل المستخدم (delayMs) تحته فوقه.
  const ms = cold ? 600 : 4000;
  const cfgDelay = cfg ? parseInt(cfg.delayMs, 10) : NaN;
  const waitMs = (Number.isFinite(cfgDelay) && cfgDelay >= 1000) ? cfgDelay : ms;
  await logger.info('scheduler', `${cold ? '⚡ ' : ''}مهلة قبل الكلمة #${(context && context.index || 0) + 1}: ${(waitMs / 1000).toFixed(1)}ث`);
  return wait(waitMs, 'predelay', signal);
}

/** استراحة طويلة كل N كلمات لمحاكاة جلسة بشرية حقيقية */
export async function cooldownIfNeeded(cfg, processedCount, signal, onBreakStart) {
  const every = cfg.cooldownEvery || 0;
  if (!every || processedCount <= 0 || processedCount % every !== 0) { return null; }
  // v1.21.40: 🔴 «راحات ثابتة» كانت بتتنادى humanDelay اللي بيرمي gaussian ±8% فوق
  // أي قيمة — يعني «10 ثواني بالظبط» كانت في الحقيقة 9–11 ثانية. بقى التذبذب بيتطبق
  // بس لو المستخدم سطّر cooldownJitterMs > 0 بنفسه (والافتراضي 0 = التزام حرفي بالثواني).
  const baseCd = Math.max(0, parseInt(cfg.cooldownMs, 10) || 10000);
  const ms = (parseInt(cfg.cooldownJitterMs, 10) || 0) > 0
    ? humanDelay(baseCd, cfg.cooldownJitterMs)
    : baseCd;
  await logger.info('scheduler', `استراحة دورية بعد ${processedCount} كلمة: ${(ms / 1000).toFixed(0)}ث`);
  if (onBreakStart) { try { await onBreakStart(ms); } catch (_) {} }
  return wait(ms, 'cooldown', signal);
}
