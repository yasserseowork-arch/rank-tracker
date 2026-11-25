# Session notes (continuation memory)

## v1.21.48 SHIPPED — fork audit + UI polish (2026-11-18)
- Commit 7fb8465 pushed (on 7bee943 .47). Zip outer 6715272 B md5 83ac84d0011bda212438289153c83c42, in-zip audit 16/16. ALSO uploaded to user's Drive folder 1GjvoaV060Am74dHIBVLlJ0Ty51pgzrJC (file id 1fN-Wn7kKGoZuE_PZeTC_0KTkdM4xUHQo) — google_drive connector now ON (also docs, notion).
- His other-AI fork = v1.23.13 unpacked in that Drive folder (NOT pushed to our git). Verdict shipped: PORTED dedupe url+title (serp.js both scanners + selfFetchMore), storeDomainPath platform guard (state sanitize + match.js domain+path), embedded.js coords unified with his GsLoc panel (25.6242618/42.3528328, radius 1000000 kept). REJECTED: num=100&pws=0 in URL (eternal ban), gl/hl re-pin (violates .47 A/B doctrine), wipe softening (1.21.38 stands).
- UI polish: side-panel.css tokens --sp-1..4 (6/10/14/18), fixed min-heights rows, .tool-frame display:block (phantom gap), table/focus/responsive; options.css same rhythm. Pure CSS.
- Env rollback trap #3 occurred mid-ship (HEAD on 7566ab4, junk commit 1991e97, push rejected): recovery = cp 14 files to /tmp, reset --hard origin-tip, cp back, re-pin missed file (constants.js — mkdir omitted src/lib!), suite, commit, push. LESSON: backup dir tree must cover EVERY edited path; ALWAYS git fetch + compare origin tip BEFORE commit; NEVER reset --hard with uncommitted edits unless backup exists.
- Doctrines standing: A/B parity (no gl/hl/ie when unset, .com fixed, googleHost explicit only), GsLoc panel-defaults SA, 403 tripwire, black-box log (footer+top15), full wipe, no captcha-internals touch, 264 tests green.

## v1.21.50 — «حل كل المشاكل + أسرع بكتير وأدق اوي اوي» (9220548, pushed; zip 6721198 B md5 f121b85495f554f3b354448ede282ed3; Drive id pending record below; 266/266; in-zip 16/16)
- 🎯 لغم دقة (كان موجود من .98!): selfFetch start كان `ceil(merged.length/10)*10` في الموضعين (الانطلاق 548 والتصحيح الذاتي) — لو المقروء الحي مش من مضاعفات 10 (15 مثلًا) بتقع فجوة #16-20 وكل المراكز بعدها تنزلق 5 لفوق. بقى `floor` ×2 — الدفعة المتكررة تتغطى والدديوب (.48) يشيل التكرار. الاختبار السلبي `/Math\.ceil\(merged\.length/` في v12150 بيحميها.
- 🚀 بايبرلاين: `inflight={start,p:grabSafe(start)}` يتولّع بعد التصحيح وقبل الـsleep؛ اللوب يستهلكه لو start مطابق وإلا يستناه ويرميه (بلا rejection يتيم); `blockReported` latch — SERP_FETCH_BLOCKED مرة واحدة للرن. مهذّب 550±300 سايد (4 تربيطات)، retry 800 سايد، batchSettleMs||5000 قراءة سايد.
- 🚀 ستل مبكر: `((companionActive() || loopN < 2) ? batchSettle : 1200)` — صفحة ساكنة بلا رفيق تتسرخص بـ1.2ث بدل 2.6؛ selfFetch يغطي #11-100 بالحرف، فمفيش خسارة دقة. loopN حارس الدورتين.
- 🔎 وعد .47 اتسدد: لوج `الرابط اللي الأداة قريته بالحرف` لكل كلمة + شارة `.res-check` 🔎 في جدول النتائج تفتح row.serpUrl (المحفوظ أصلًا).
- CSS: .res-check ملحق بعد بلوك focus-visible بنفس السطر-الواحد ستايل؛ الملف LF (حصل CRLF من write خاطئ واتظبط — قاعدة: side-panel.css LF بس، والكلك فينده بلوكات سطر واحد).
- ROLLBACK #6: HEAD رجع 7566ab4 تاني أول المكالمة؛ origin فيه f599d15 كامل فـ `git reset --hard origin/...` نضيف (مفيش شغل غير متسجل ضاع). القاعدة لسه: fetch+قارنة origin قبل أي commit.
- اختبار v12150 كان فيه `'x' in css` (in على نص = TypeError) — بقى includes.

## v1.21.51 — حائط «تسجيل الدخول» + بار الأحداث (d7f873d, pushed; zip 6724569 B md5 2657846b1e56e3f017330df88473ef63; Drive id 1kIGxo0lbpkq_eR6wsXqdF5UA5d0cVzlG؛ 267/267; in-zip 17/17)
- Cause (his screenshot #22): Google's «تسجيل الدخول للمتابعة» proof-wall = neither captcha nor noResults → was scanned empty, keywords logged «مش موجود». FIX: errorsig 'login-wall' (AR/EN body sigs incl «يُرجى تسجيل الدخول لإثبات أنك شخص حقيقي» + «sign in to continue»), serp.js routes to refusal path at 4 read points (handleBadPage, firstPoll w/ firstPollKind var, mid-dive midKind, selfFetch grab regex) → queue newtab flow: cooldown 0.8-1.5 → data clear+fresh tab SAME keyword. Never a false verdict now.
- 📟 Activity bar: rest-strip MOVED in HTML to directly under main buttons (above stats); engine `setPhase(txt,until,total)` publishes: 0.6/4s predelay (mirrors scheduler consts — display only), ☕ cooldownIfNeeded, 🧊 siege chill 30s, 🧊 post-solve cools (8-14 & 10-18), 🧩 captcha-wait (infinite no-count pulse, CSS @keyframes restPulse), 🚦 park-restart, 🧱/ refusal/wall message. Cleared on start/stop/end (setRun patches). Tick gate extended; strip hides when idle.
- i18n added phaseLeft AR+EN. Tests: v12151 behavioral (loads errorsig via v119loadClassic, exact wall strings) + v12145 repinned to widened midKind guard. 267 tests.
- Cyrillic slip «никогда» in CHANGELOG caught by stray-script scan (CJK scan alone insufficient — extend scans to 0x400-0x4FF!).

## v1.21.52 — الرقابة الذاتية + عدّادات الصبر + استشارة الدخول (5117301, pushed; zip 6726886 B md5 1dba23c5a04fde086b4f1402b67827be; 268/268; in-zip 15/15)
- ROLLBACK #7 happened AGAIN at turn start (HEAD 7566ab4, manifest 1.14.0); recovered via fetch + `git reset --hard origin/...` → 97d0bc1; no uncommitted work existed (only reads). ALWAYS fetch+compare before any edit in a new turn — first action of every turn from now on.
- 🩺 «بتقف» root cause: loop wedged in long waits (post-captcha yoga/stale), panel silent — user's pause+resume = real cure; automated: broadcast() → run.beatTs stamp; watchdogTick new branch: active && looping && now-beat>180000 → pendingRestart=true + status RUNNING + abort + fresh AbortController → finally restarts loop() at same index (same keyword). All legit waits ≤66s so 3-min threshold never false-positives.
- 📟 🧘 wait phase now Date.now()+66000 countdown; stale-cap 20s break +21000 countdown.
- 💡 maybeAdviseSignIn(): captchaSeenThisRun>=3 once/run at both increments (609/754), reset at 1623. Counsel only (screenshots showed signed-out profile + 15 solves).
- Pins: probes 800/1200, waited>=60, recordExhausted×8 (count asserted in v12152), preDelays 600/4000, .50/.51 suites intact.
