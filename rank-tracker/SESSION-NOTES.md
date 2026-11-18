
## v1.21.49 — السرعة المشروعة (bc4da5f, pushed; zip 6717207 B md5 2f16fffe82f6213bd00f979daad081a3; Drive id 1gspwuNv7LZDFVStjFkmQJ8ltyGTMBcaw; 265/265; in-zip audit 15/15)
- serp.js: فاست-لينج full0 (page كامل من أول شاشة → sleep350 + finalizeAi(600) + بلا قفل سكرول، fullPageFast:true)، تسوية الاكتمال داخل اللفة 1100→350، selfFetch retry 1200→800، humanSleep(550,250)→(350,150) مع الحفاظ على نص «سكتة ثم فرصة تانية» (تربيط v1198).
- queue.js: btAdvised مرة/رن — لو القراءة < expectedNum−10 → لوج 🚀 تركيب BeyondTen.
- ثوابت غير ملموسة: 600/4000 pre-delay، cooldown 10s/10، wipe .38، حظ num/pws/gl، دديوب .48، تريبواير 403.
- v12120 أُعيد تربيطه على إيقاع .49 (800 / 350±150).
- ⚠️ ROLLBACK #5 (نفس الليلة، قبل الـpush): HEAD رجع 7566ab4+treepollution؛ النسخ الاحتياطي الكامل لـ/tmp/s49 (7 ملفات + cmp) ثم reset --hard 7fb8465 ثم النسخ العكسي → 265/265 → commit bc4da5f push ✅. القاعدة: دايمًا `git fetch` + مقارنة origin قبل commit، و cmp بعد كل cp.
