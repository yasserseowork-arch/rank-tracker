/**
 * solver.js — النسخ الصوتي المحلي لكابتشا جوجل (نفس المحرك اللي باستر بيستخدمه:
 * offscreen document + ONNX wasm + نموذج Whisper محمول جوه الإضافة).
 * إحنا مش بنعتمد على بروتوكول باستر الداخلي بتاع التبويب — بنكلم offscreen
 * مباشرة على البورت بتاعه وبنقفل الوثيقة بعد كل طلب (زي ما هو بيعمل) عشان الذاكرة.
 */
import * as logger from './logger.js';

const OFFSCREEN_URL = 'src/asr/index.html'; // محرك ASR الخاص بالأداة (بنفس تقنية باستر: offscreen + ONNX/wasm + Whisper) — لا شيء من باستر نفسها في الإضافة
const PORT_NAME = 'offscreen';
const SILENT_WAV_B64 = 'UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YSADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

let chain = Promise.resolve(); // تسلسل: طلب واحد في الميعاد — offscreen موديل واحد

async function hasDoc() {
  try { return await chrome.offscreen.hasDocument(); } catch (_) { return false; }
}

async function ensureDoc() {
  if (await hasDoc()) { return; }
  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ['USER_MEDIA'],
      justification: 'تحويل صوت كابتشا جوجل لكلام — نموذج محلي داخل الإضافة'
    });
  } catch (err) {
    const msg = String((err && err.message) || '');
    // 'Only a single offscreen document may be created' — مسابقة بين طلبين: تمام
    if (!/single offscreen|already/i.test(msg)) { throw err; }
  }
}

async function closeDoc() {
  try { if (await hasDoc()) { await chrome.offscreen.closeDocument(); } } catch (_) {}
}

function toB64(arrayBuf) {
  const bytes = new Uint8Array(arrayBuf);
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  }
  return btoa(bin);
}

/** رسالة واحدة لبورت offscreen والرد — بtimeout صريح وبلا تعليق لو الموت ما رجعش */
function askPort(msg, timeoutMs) {
  return new Promise((resolve, reject) => {
    let port;
    try { port = chrome.runtime.connect({ name: PORT_NAME }); } catch (e) { reject(e); return; }
    let done = false;
    const finish = (fn, v) => {
      if (done) { return; }
      done = true;
      clearTimeout(timer);
      try { port.disconnect(); } catch (_) {}
      fn(v);
    };
    const timer = setTimeout(() => finish(reject, new Error('offscreen-timeout')), timeoutMs || 240000);
    port.onMessage.addListener((m) => {
      if (!m || m.result === undefined) { return; }
      const r = m.result;
      const text = (r && typeof r.text === 'string') ? r.text : (typeof r === 'string' ? r : '');
      finish(resolve, text ? text.replace(/\s+/g, ' ').trim().toLowerCase() : null);
    });
    port.onDisconnect.addListener(() => finish(reject, new Error('offscreen-disconnected')));
    try { port.postMessage(msg); } catch (e) { finish(reject, e); }
  });
}

/** نسخ رابط صوت التحدي لنص — بصف طلبات داخلي (موديل واحد) */
export function transcribeAudioUrl(audioUrl, timeoutMs) {
  const job = chain.then(async () => {
    if (!chrome.offscreen) { throw new Error('offscreen-unavailable'); }
    const resp = await fetch(audioUrl, { credentials: 'omit' });
    if (!resp.ok) { throw new Error('audio-fetch:' + resp.status); }
    const buf = await resp.arrayBuffer();
    if (!buf || !buf.byteLength) { throw new Error('audio-empty'); }
    await ensureDoc();
    try {
      return await askPort(
        { id: 'transcribeAudio', audioString: toB64(buf), audioOptions: {} },
        timeoutMs || 240000
      );
    } finally {
      await closeDoc();
    }
  });
  chain = job.then(() => {}, () => {});
  return job;
}

/**
 * تسخين: أول مرة بس — النموذج (Whisper-tiny ~40MB) بيتنزّل من HuggingFace ويكش
 * في تخزين الإضافة؛ بنعمله في الخلفية أول التشغيل عشان الكابتشا الأولى ماتستناش.
 */
export function prewarm() {
  chain = chain.then(async () => {
    if (!chrome.offscreen) { return; }
    try {
      await ensureDoc();
      try {
        await askPort({ id: 'transcribeAudio', audioString: SILENT_WAV_B64, audioOptions: {} }, 30 * 60 * 1000);
      } finally {
        await closeDoc();
      }
      await logger.info('solver', '🧠 محرك النسخ الصوتي جاهز — النموذج محمّل ومكشوّك محليًا');
    } catch (err) {
      await logger.warn('solver', 'تسخين المحرك Voice فشل هيتحاول مع أول تحدي: ' + (err && err.message));
    }
  });
}
