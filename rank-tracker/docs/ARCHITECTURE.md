# Architecture — Saudi Rank Tracker (MV3)

## مخطط المكونات

```
┌──────────────────────────── Chrome ────────────────────────────┐
│                                                                 │
│  Side Panel (RTL)                 Options                       │
│   ├─ controls/stats/chart          └─ advanced + backup         │
│   ├─ keywords & results tables                                  │
│   └─ live log  ────────┐                                        │
│            │ keepalive port (يبقي SW حياً)                      │
│            ▼                                                    │
│  Service Worker (module)                                        │
│   ├─ router.js      رسائل اللوحة + منافذ keep-alive             │
│   ├─ queue.js       محرك الطابور (state machine لكل كلمة)       │
│   ├─ scheduler.js   مهل بشرية + alarms (تجاوز حد 30s)           │
│   ├─ tabctl.js      تبويبات + مراقبة تغيّر URL                  │
│   ├─ captcha-orchestrator.js  دورة Buster الكاملة               │
│   ├─ state.js       storage.local + storage.session + migrate   │
│   ├─ match.js       تطبيع عربي + مطابقة (نقي/مُختبر)            │
│   └─ logger.js/bus.js/rand.js/urlkit.js/bridge.js               │
│            │ chrome.tabs.sendMessage (لكل الإطارات)             │
│            ▼                                                    │
│  Content Scripts                                                │
│   ├─ serp.js      (google.com/search)  قراءة 100 نتيجة          │
│   ├─ captcha.js   (/sorry/ + recaptcha frames, all_frames)      │
│   │     ├─ دور page   : إعلان وجود الكابتشا                     │
│   │     ├─ دور anchor : مراقبة checkbox                         │
│   │     └─ دور bframe : تشغيل Buster + ⟳ تحدي جديد              │
│   └─ consent.js   (consent.google.com)                          │
└─────────────────────────────────────────────────────────────────┘
```

## بروتوكول الرسائل (كل الأنواع بادئة `srt/`)

| الرسالة | الاتجاه | الغرض |
|---|---|---|
| `serp/started`, `serp/parsed` | content → SW | بداية القراءة / النتائج الخام |
| `captcha/present` | content(page) → SW | رصد صفحة /sorry/ |
| `captcha/checked` | content(anchor) → SW | checkbox تم التحقق منه |
| `captcha/attempt` | content(bframe) → SW | Buster بدأ محاولة |
| `captcha/error` | content(bframe) → SW | رسالة خطأ صوتي من reCAPTCHA |
| `captcha/challenge-closed` | content(bframe) → SW | اختفاء نافذة التحدي |
| `captcha/buster-not-found` | content(bframe) → SW | زر الحلّال غير موجود |
| `captcha/cmd/next` | SW → content(bframe) | ⟳ تحدي جديد ثم Buster |
| `captcha/cmd/stop|probe` | SW ↔ content | إيقاف/استعلام حالة |
| `queue/start|pause|resume|stop` | panel → SW | تحكم بالطابور |
| `config/get|set`, `state/get` | panel ↔ SW | إعدادات ولحظة كاملة |
| `state/broadcast` | SW → panel | تحديث حي بعد كل حدث |
| `log` | أي طرف → SW → panel | السجل الحي |
| `keepalive` | content/panel → SW | نبضات إبقاء الحياة |

## إبقاء Service Worker حياً (مشكلة MV3 الأشهر)

1. **Port دائم** من اللوحة الجانبية (`connectKeepalive`) — يمنع إنهاءWorker ما دامت مفتوحة.
2. **نبضات `keepalive`** من content scripts كل 20 ثانية أثناء العمل.
3. **أحداث التبويبات** (`onUpdated/onRemoved`) تُوقظ الـ Worker طبيعياً.
4. **chrome.alarms** للمهل > 25 ثانية عند غياب العملاء.
5. **استئناف بعد الاستيقاظ**: حالة التشغيل في `storage.session`؛
   عند cold-start如果发现 run=running تُستأنف الحلقة من `currentIndex`.

## التخزين

| المفتاح | المكان | المحتوى |
|---|---|---|
| `srt.config` | local | كل الإعدادات (مع قيم افتراضية آمنة) |
| `srt.keywords` | local | الكلمات + حالتها + تاريخها |
| `srt.results` | local | آخر 2000 فحص |
| `srt.run` | session | حالة التشغيل الحالية + عدادات الكابتشا |
| `srt.logs` | session | آخر 400 سطر سجل |
| `srt.schemaVersion` | local | هجرة البيانات بين الإصدارات |

## قرارات تصميمية مهمة

- **المطابقة في الـ SW لا في المحتوى**: محتوى التبويب يرسل نتائج خام فقط،
  والمنطق الحساس (دومين/اسم/تطبيع) مركزي ونقي وقابل للاختبار.
- **content scripts كلاسيكية متعددة الملفات**: مصفوفة `js` في المانيفست
  تحقنها بالترتيب في نفس الـ isolated world فتشارك الـ globals (`SRT_C`, `SRT`).
- **وحدات الخلفية ES modules** مع `bridge.js` لتوحيد الثوابت بين العالمين.
- **لا API خارجي إطلاقاً**: حتى جلب الشيت يتم عبر نقطة تصدير CSV العامة
  (`/gviz/tq?tqx=out:csv`) بصلاحيات مضيف فقط، والكتابة عبر CSV/TSV للصق.
