# CAPTCHA × Buster — كيف تتعاون الإضافة مع حلّال الكابتشا

## المشهد (مطابق للصورة المرفقة من المستخدم)

```
┌ صفحة google.com/sorry/?continue=… ────────────────────────────────┐
│  [checkbox] I'm not a robot        ← iframe: /recaptcha/api2/anchor │
│                                                                     │
│  ┌ نافذة التحدي الصوتي — iframe: /recaptcha/api2/bframe ──────────┐ │
│  │  Press PLAY to listen  [  PLAY  ]                              │ │
│  │  Enter what you hear   [________]                              │ │
│  │                              ⬇                                 │ │
│  │  [⟳ reload] [🔉] [🟠 Buster] [ VERIFY ]                        │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
        + إشعار Chrome من Buster: "Wit.ai could not detect any speech…"
```

العناصر المؤطرة بالأحمر في صورة المستخدم هي بالضبط ما تتعامل معه الإضافة:
1. **زر Buster** (الشخص البرتقالي ✔) — نضغطه ليبدأ الحل الصوتي.
2. **زر التحدي الجديد** (السهم الدائري ⟳) — نضغطه عند فشل المحاولة.
3. **لوحة الصوت** (PLAY / حقل الإدخال / VERIFY) — يديرها Buster نفسه.

## لماذا لا نضغط PLAY أو VERIFY بأنفسنا؟

Buster يمسك دورة الصوت كاملة (تشغيل، التقاط، تعرف، تعبئة، تحقق).
تدخلنا المباشر قد يسابق منطق Buster ويكسر المحاولة. دورنا **قيادة المحاولات**:
متى نبدأ، ومتى نعلن الفشل، ومتى نطلب تحدياً جديداً.

## اكتشاف زر Buster بدون معرفة معرف الإضافة

زر Buster محقون داخل مستند iframe الخاص بـ reCAPTCHA، ومستندات الإطارات مشتركة بين
كل content scripts في نفس الـ frame، لذلك نكتشفه بأي عنصر مصدره امتداد آخر:

```js
SEL.buster = [
  'img[src^="chrome-extension://"]',
  'iframe[src^="chrome-extension://"]',
  '[id*="buster" i]', '[class*="buster" i]',
  'button[aria-label*="buster" i]', 'button[title*="buster" i]'
]
```
داخل مستند reCAPTCHA لا يوجد أي مصدر `chrome-extension://` مشروع آخر،
فأي إصابة = زر الحلّال. نضغط أقرب سلف قابل للنقر (`button/[role=button]/…`).

## محددات reCAPTCHA المستخدمة (مع بدائل تراجع)

| العنصر | المحدد الأساسي | بدائل |
|---|---|---|
| checkbox | `.recaptcha-checkbox-checked` | `#recaptcha-anchor[aria-checked="true"]` |
| تحدي جديد ⟳ | `#recaptcha-reload-button` | `.rc-button-reload`, نص "new challenge"/"تحدي جديد" |
| PLAY | `#recaptcha-play-button` | `.rc-audiochallenge-play-button button` |
| حقل السمع | `#audio-response` | `#audio-input` |
| VERIFY | `#recaptcha-verify-button` | `.rc-button-recaptcha-verify` |
| رسالة الخطأ | `.rc-audiochallenge-error-message` | `.rc-audiochallenge-error` |

## إشارات "تم الحل" (بالأولوية)

1. **تغيّر رابط التبويب** بعيداً عن `/sorry/` (جوجل يعيد التوجيه لـ `continue`) — الأقوى.
2. `CAPTCHA_CHECKED` من إطار الـ anchor (classList / aria-checked).
3. `CAPTCHA_CHALLENGE_CLOSED`: اختفاء نافذة التحدي الصوتي من bframe،
   ثم تأكيد بالرابط بعد 3.5 ثوانٍ.

## خوارزمية المحاولات

```
probe(bframe) → لا يوجد زر Buster؟ انتظر 8 ثوانٍ ثم أعلن no-buster
loop attempt = 1..maxAttempts:
    waitSolved(attemptTimeout)
        ├─ solved → خروج ناجح
        └─ timeout:
             tabs.sendMessage(CAPTCHA_CMD_NEXT)   // ⟳ ثم 🟠 Buster
             sleep(captchaGapMs)
fail → pause(captcha-failed) + notification + focus tab
        └─ waitManualSolve → auto resume   أو   resume يدوي = تخطي الكلمة
```

## قيادة ذاتية كاملة (Self-Driving) — جديد 1.1.0

الإطار لا ينتظر أوامر المحرك ليتصرف، بل يعمل كآلة حالة محلية كل 900 ملي ثانية:

```
كل 900ms في إطار التحدي (bframe):
  لا تحدي مفتوح وبعد محاولات    → أعلن CHALLENGE_CLOSED (إشارة حل)
  زر Buster موجود (صور أو صوتي) → اضغطه مباشرة 🟠 (محاولة n)
  لا زر وتحدي صور فقط           → جرّب زر السماعة احتياطياً
  لا زر إطلاقاً                 → بلّغ BUSTER_NOT_FOUND كل 10ث
  رسالة فشل صوتي أو مهلة انتهت  → اضغط ⟳ تحدي جديد ثم 🟠 Buster (محاولة n+1)
  المحاولات = الحد الأقصى       → أعلن CAPTCHA_FAILED مرة واحدة
```

> ملاحظة من لقطة المستخدم الحقيقية: زر Buster يظهر **في صف أزرار تحدي الصور**
> نفسه (بجانب ⟳ والسماعة وSKIP)، لذلك لا نُحوّل للصوتي قبل ضغطه — الضغط المباشر
> هو السلوك الصحيح، والتحويل للصوتي مجرد احتياط إن غاب الزر.

وفي إطار الـ anchor: ضغطة checkbox بشرية واحدة بعد 1.5ث إن لم يُحل مباشرة،
ومراقبة علامة الحل دورياً. وفي صفحة /sorry/: إعلان CAPTCHA_PRESENT كل 2.5ث
حتى لا تُفوّت الرسالة بسبب سباق أحداث مع المحرك.

## لماذا كل هذا في إطارات منفصلة؟

- `/sorry/` (الإطار الأعلى): يعلن وجود الكابتشا ويراقب ظهور iframe.
- `anchor`: يراقب علامة الحل على الـ checkbox.
- `bframe`: يشغّل Buster ويضغط ⟳ عند الحاجة ويبلغ بأخطاء الصوت.
التواصل بينها جميعاً يمر عبر الـ Service Worker (لا مراسلة مباشرة بين الإطارات)،
مع `all_frames: true` وأنماط مطابقة تغطي `google.com/recaptcha/*` و`recaptcha.net`
و`gstatic.com/recaptcha/*`.
