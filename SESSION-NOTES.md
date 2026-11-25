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
