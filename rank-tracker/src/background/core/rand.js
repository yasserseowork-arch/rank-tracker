/**
 * rand.js — مولدات عشوائية بطابع بشري (دوال نقية قابلة للاختبار)
 */

export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** إزاحة عشوائية ضمن ±jitter */
export function jitter(base, jitterMs) {
  const j = Math.max(0, jitterMs || 0);
  if (!j) { return base; }
  return Math.max(0, base + randInt(-j, j));
}

/** توزيع طبيعي تقريبي (Box-Muller مبسّط) لمحاكاة سلوك بشري أدق */
export function gaussian(base, sigma) {
  const u = 1 - Math.random();
  const v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(0, Math.round(base + z * (sigma || base * 0.15)));
}

/** مهلة بشرية مركّبة: أساس + jitter + نبضة gaussian صغيرة */
export function humanDelay(base, jitterMs) {
  return jitter(gaussian(base, Math.max(120, base * 0.08)), jitterMs);
}

/** اختيار عنصر عشوائي */
export function pick(arr) {
  if (!arr || !arr.length) { return null; }
  return arr[randInt(0, arr.length - 1)];
}

/** نوم قابل للإلغاء عبر AbortSignal */
export function sleep(ms, signal) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (signal) { signal.removeEventListener('abort', onAbort); }
      resolve({ aborted: false });
    }, Math.max(0, ms));
    function onAbort() {
      clearTimeout(timer);
      resolve({ aborted: true });
    }
    if (signal) {
      if (signal.aborted) { clearTimeout(timer); resolve({ aborted: true }); return; }
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}
