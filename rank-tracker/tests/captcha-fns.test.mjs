/**
 * captcha-fns.test.mjs — اختبار انحدار للعلة الصامتة القاتلة:
 * آلة حل الكابتشا الذاتية كانت تستدعي دوال غير معرّفة (findReloadButton / challengeOpen /
 * audioOpen / imageOpen / reportAttempt) فتموت بصمت من أول tick وتُبقي عدّاد المحاولات
 * عالقاً على صفر. هنا نتأكد أن كل دوال الآلة معرّفة في الملف فعلاً.
 * v1.17.0: الآلة بقت بتحل بنفسها (نسخ الصوت عبر خدمة Buster المدمجة + تعبئة النص + تحقق)
 * بدل ما تعتمد على ضغطة زرار Buster اللي كانت مستحيلة (shadow root مغلق + isTrusted).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const src = fs.readFileSync(path.resolve(process.cwd(), 'src/content/captcha.js'), 'utf8');
const orch = fs.readFileSync(path.resolve(process.cwd(), 'src/background/core/captcha-orchestrator.js'), 'utf8');

const REQUIRED_FUNCTIONS = [
  'findReloadButton',
  'challengeOpen',
  'audioOpen',
  'imageOpen',
  'switchToAudio',
  'reportAttempt',
  'findBusterButton',
  'topCoordsOf',
  'clickBuster',
  'scanScope',
  // v1.17.0 — دوال الحل الذاتي الحقيقي:
  'waitAudioSrc',
  'busterHolder',
  'transcribe',
  'fillResponse',
  'newChallenge',
  'solveAudioOnce',
  // v1.17.1 — جسر الترحيل بين الإطارات والصفحة:
  'ownFrameOffset',
  'postUp',
  'postDown',
  'pushStateUp'
];

for (const fn of REQUIRED_FUNCTIONS) {
  test(`captcha.js: الدالة ${fn} معرّفة (علة الآلة الصامتة)`, () => {
    assert.ok(new RegExp('function ' + fn + '\\s*\\(').test(src), `${fn}() غير معرّفة — حل الكابتشا الذاتي سيموت بصمت`);
  });
}

test('captcha.js: عدّاد المحاولات بيتحدث عبر reportAttempt', () => {
  // reportAttempt لازم يزوّد S.attempts ويسجّل وقت آخر ضغطة — بدونهم الآلة ما تعرفش تعيد المحاولة
  assert.ok(/S\.attempts\s*\+=\s*1/.test(src), 'S.attempts لا يُزوَّد في reportAttempt');
  assert.ok(/S\.lastClickTs\s*=/.test(src), 'S.lastClickTs لا يُسجَّل');
});

test('captcha.js: الحل الذاتي بينسخ الصوت عبر خدمة transcribeAudio المدمجة', () => {
  // دي الخدمة الحقيقية بتاعة Buster المدمجة في خلفية الإضافة — بدونها الحل مستحيل
  assert.ok(/id:\s*'transcribeAudio'/.test(src), 'لا يوجد استدعاء لخدمة transcribeAudio المدمجة');
  assert.ok(/audio#audio-source/.test(src), 'لا يوجد انتظار لمصدر صوت التحدي');
});

test('captcha.js: الحل الذاتي بيملأ الإجابة ويضغط تحقق', () => {
  assert.ok(/#audio-response/.test(src), 'لا توجد تعبئة لخانة الإجابة الصوتية');
  assert.ok(/recaptcha-verify|C\.SEL\.recaptcha\.verify/.test(src), 'لا يوجد ضغط على زر التحقق');
});

test('captcha.js: البديل — ضغطة حقيقية بالإحداثيات على زرار Buster', () => {
  assert.ok(/CAPTCHA_COORD_CLICK/.test(src), 'لا يوجد مسار ضغطة الإحداثيات البديل');
  assert.ok(/help-button-holder/.test(src), 'لا يوجد كشف عن حاضنة زرار Buster');
});

test('orchestrator: ما يفشلش بسرعة لو زر Buster مش ظاهر — التحدي المفتوح يكفي', () => {
  // v1.17.0: زرار Buster جوه shadow root مغلق فمستحيل يتشاف — كان لازم المنسّق
  // يستنى حل الآلة الذاتية بدل ما يعلن no-buster بعد 8 ثواني ويودي للخطة الاحتياطية
  assert.ok(/challengeOpen\s*===\s*true/.test(orch), 'المنسّق لا يعتبر التحدي المفتوح دليل حل نشط');
  assert.ok(/waitChallenge\s*\(/.test(orch), 'waitChallenge غير معرّفة');
});

test('orchestrator: مهلة الجولة تستوعب دورة الحل الذاتي كاملة', () => {
  // دورة الحل: صوت (~12ث) + نسخ (~60ث) + حكم (~5ث) — لو الجولة أقصر المنسّق هيقاطع الحل
  assert.ok(/120000/.test(orch), 'لا يوجد حد أدنى 120 ثانية لمهلة الجولة');
});

test('orchestrator: الأمر محمي بمهلة — مفيش انتظار معلّق للأبد', () => {
  // tabs.sendMessage من غير رد بيرجّع Promise معلّق للأبد — لازم في سباق مهلة
  assert.ok(/Promise\.race/.test(orch), 'command() بدون سباق مهلة — ممكن يعلّق المحرك للأبد');
});

test('captcha.js: سلسلة الترحيل بتوصل ضغطة التحقق للمحرك', () => {
  // v1.17.1: الصفحة العليا بتبعت CAPTCHA_VERIFY_CLICK للخلفية عشان debugger ينفذها
  assert.ok(/CAPTCHA_VERIFY_CLICK/.test(src), 'لا يوجد إرسال CAPTCHA_VERIFY_CLICK من الصفحة');
  assert.ok(/act:\s*'verify-click'/.test(src), 'لا يوجد طلب ضغطة تحقق عبر سلسلة الترحيل');
  assert.ok(/postMessage/.test(src), 'لا يوجد postMessage للترحيل بين الإطارات');
});

test('captcha.js: الصفحة العليا بترد على أوامر المحرك فوراً', () => {
  // الصفحة بتستقبل CAPTCHA_CMD_PROBE وترد من آخر حالة للآلة — المحرك مش بيستنى رد مفيش
  assert.ok(/CAPTCHA_CMD_PROBE/.test(src), 'الصفحة لا ترد على أوامر الفحص');
  assert.ok(/stateCache/.test(src), 'لا يوجد تخزين لآخر حالة الآلة في الصفحة');
});
