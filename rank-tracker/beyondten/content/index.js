
// content/index.js (native clone + numbering)
// Developed by Ayub Ansary - SEO Specialist (https://ayubansary.com)
// Helping businesses grow beyond limitations
(function () {
  const SLOW_MIN = 280, SLOW_JIT = 360;
  const state = window.BT.state;
  const { getContext, currentPageIndex, startOffset } = window.BT.params;
  const { delay, fetchSERP } = window.BT.fetcher;
  const { extractTopLevelItems } = window.BT.parser;
  const { purgeNonOrganic, watchForRegrowth } = window.BT.purge;
  const { mountUI, resetUI, setStatus, countNative, countInjected, appendTopLevelItems, renumberAll } = window.BT.render;


  function looksLikeConsent(doc) {
    // Enhanced consent detection
    const rso = doc.querySelector("#search #rso, #rso");
    if (!rso) {
      // Check if this is a consent page
      const consentElements = doc.querySelector("form[action*='consent']");
      return !!consentElements;
    }
    return false;
  }
  function normalizeURL(u) {
    try {
      const x = new URL(u);
      ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"].forEach(k => x.searchParams.delete(k));
      x.hash = "";
      return x.toString();
    } catch { return u; }
  }
  function boot() {
    chrome.storage.sync.get(['resultsCount', 'extensionEnabled', 'autoLoad', 'pureMode'], (d) => {
      state.settings.target = Number(d.resultsCount || '100');
      state.settings.enabled = d.extensionEnabled !== false;
      state.settings.autoLoad = d.autoLoad !== false;
      state.settings.pureMode = d.pureMode === true; // إيقاف افتراضي: عدم إخفاء أي مناطق من صفحة النتائج
      if (!state.settings.enabled) return;

      const ctx = getContext();
      if (!ctx) return;

      // Disable on specific non-web modes (tbm or udm=2 for images)
      if (ctx.params.has("tbm") || ctx.params.get("udm") === "2") {
        mountUI(state.settings.target, true);
        return;
      }

      window.BT.state.seen.clear();
      const ui = mountUI(state.settings.target, false);
      ui.btn.addEventListener("click", () => startLoading());
      ui.cancel.addEventListener("click", cancelWork);

      if (state.settings.pureMode) {
        purgeNonOrganic();
        state.obs = watchForRegrowth();
      }

      // First renumber native items so users see numbers instantly
      renumberAll(startOffset());

      if (state.settings.pureMode || state.settings.autoLoad) {
        // Add a small delay to ensure DOM is ready
        setTimeout(() => startLoading(), 100);
      }

      // Also check after a longer delay in case of slow loading
      setTimeout(() => {
        const total = countNative() + countInjected();
        if (total < 10) startLoading();
      }, 1500);
    });
  }

  async function startLoading() {
    const ctx = getContext();
    if (!ctx) return;
    const ui = window.BT.render.getUI();
    if (!ui) return;

    if (ui.btn.hasAttribute("disabled")) return;
    ui.btn.setAttribute("disabled", "true");
    ui.cancel.style.display = "inline-block";

    // Prepare AbortController
    state.aborter?.abort();
    state.aborter = new AbortController();
    const signal = state.aborter.signal;

    // Calculate Targets
    let total = countNative() + countInjected();
    if (total >= state.settings.target) { setStatus(`Done · ${total} results`); cleanup(); return; }

    const allTargets = remainingTargets();

    // Split Targets: "first load 1-2 page at once, then 3-7 on arrival"
    // Phase 1: Immediate (Next 1 page)
    // Phase 2: Deferred (The rest)
    const immediateTargets = allTargets.slice(0, 1);
    const deferredTargets = allTargets.slice(1);

    // --- PHASE 1: IMMEDIATE FETCH ---
    if (immediateTargets.length > 0) {
      await fetchBatch(immediateTargets, ctx, signal);
    }
    // v1.2.0: If page 2 already arrived and the total is missing (broken scroll), don't rely on the sensor —
    // the chaser is a safety net for the two paths together
    if (remainingTargets().length && !state.chaser) startChaser(signal);

    // --- PHASE 2: DEFERRED (SCROLL TRIGGER + v1.2.0 auto-chaser) ---
    if (deferredTargets.length > 0) {
      // Create a sensor at the bottom
      setStatus(`Loaded ${countNative() + countInjected()}. Scroll for more...`);
      setupScrollObserver(deferredTargets, ctx, signal);
      // 🛡v1.2.0 The scroll sensor sometimes doesn't appear (no #rso / no scroll / stuck):
      // auto-chaser finishes off remaining batches with polite pauses — the extension never stays stuck on "Scroll for more"
      startChaser(signal);
    } else {
      setStatus(`Done · ${countNative() + countInjected()} results`);
      ui.btn.removeAttribute("disabled");
      ui.cancel.style.display = "none";
    }
  }

  // v1.2.0: list of missing pages calculated from loadedPages — not from an old snapshot
  function remainingTargets() {
    const ctx = getContext();
    if (!ctx) return [];
    const needPages = Math.ceil(state.settings.target / 10);
    const curIdx = currentPageIndex();
    const out = [];
    for (let i = 0; i < needPages; i++) if (i !== curIdx && !state.loadedPages.has(i)) out.push(i);
    return out;
  }

  function stopChaser() {
    if (state.chaser) { clearInterval(state.chaser); state.chaser = null; }
  }

  function startChaser(signal) {
    if (state.chaser) return;
    let ticks = 0;
    state.chaser = setInterval(async () => {
      ticks++;
      if (signal.aborted || ticks > 60) { stopChaser(); return; } // 5 minutes then politely retreat
      const remaining = remainingTargets();
      if (!remaining.length) { finishAll(); return; }
      if (state.fetching) return; // an active batch is already running
      const ctx = getContext();
      if (!ctx) return;
      try { await fetchBatch(remaining, ctx, signal); } catch (e) {}
      if (!remainingTargets().length) finishAll();
    }, 5000);
  }

  function finishAll() {
    stopChaser();
    const ui = window.BT.render.getUI();
    if (ui) { ui.btn.removeAttribute("disabled"); ui.cancel.style.display = "none"; }
    setStatus(`Done · ${countNative() + countInjected()} results`);
  }

  // Helper: Fetch a specific list of pages
  async function fetchBatch(targets, ctx, signal) {
    let CONCURRENCY = window.BT.state.concurrency || 2;
    for (let i = 0; i < targets.length; i += CONCURRENCY) {
      if (signal.aborted) break;
      const batch = targets.slice(i, i + CONCURRENCY);
      const label = batch.length > 1 ? `${batch[0] + 1}–${batch[batch.length - 1] + 1}` : `${batch[0] + 1}`;
      setStatus(`Loading page ${label}…`);
      const grab = () => Promise.all(batch.map(idx => window.BT.fetcher.fetchSERP(ctx, idx, signal)));
      let htmls = null;
      let consentBreak = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        try { htmls = await grab(); break; }
        catch (e) {
          if (e?.name === "AbortError" || String(e).includes("Aborted")) throw e;
          if (e && String(e).includes("consent_wall")) { setStatus("Consent needed. Click page."); consentBreak = true; break; }
          if (/429|sorry_page/.test(String(e)) && attempt === 0) {
            // Google rate limit — rest a bit and retry quietly once without flooding the console
            console.info("BeyondTen: rate limited (429) — cooling down, retrying once");
            setStatus(`Cooling down… (page ${label})`);
            await new Promise(r => setTimeout(r, 20000 + Math.floor(Math.random() * 25000)));
            if (signal.aborted) return;
            continue;
          }
          console.info("BeyondTen: batch skipped:", (e && e.message) || e);
          break;
        }
      }
      if (consentBreak) {
        // v1.2.0: consent wall = one calm retry after 20s (the chaser refills the rest) — not a permanent stop
        setTimeout(() => { if (!signal.aborted) { const u = window.BT.render.getUI(); if (u && u.btn.hasAttribute("disabled")) startLoading(); } }, 20000);
        break;
      }
      if (htmls) {
        let appended = 0;
        htmls.forEach((html, j) => {
          const idxp = batch[j];
          const doc = new DOMParser().parseFromString(html, "text/html");
          if (looksLikeConsent(doc)) { consentBreak = true; return; }
          const blocks = window.BT.parser.extractTopLevelItems(doc);
          const unique = [];
          blocks.forEach(b => {
            const a = b.querySelector(".yuRUbf a[href]") || b.querySelector("a[href]");
            const href = a?.href || "";
            const norm = normalizeURL(href);
            if (!norm) return;
            if (window.BT.state.seen.has(norm)) return;
            window.BT.state.seen.add(norm);
            unique.push(b);
          });
          appendTopLevelItems(unique);
          // v1.2.0: only mark a page as "finished" if it had actual results — a block/empty page isn't
          // marked, and the chaser retries it later. Here's where the extension used to "break": holes in 11..100 were never retried
          if (blocks.length > 0) window.BT.state.loadedPages.add(idxp);
          appended += unique.length;
        });
        if (consentBreak) { setStatus("Consent needed. Click page."); break; }
        renumberAll(startOffset());
        // Soft throttle if empty results
        if (appended < 5 && CONCURRENCY > 2) CONCURRENCY = Math.max(2, CONCURRENCY - 1);
      }
      // v1.2.1: فاصل مهذب بين الدفعات — طلبات ورا بعضها بسرعة = /sorry/
      if (i + CONCURRENCY < targets.length && !signal.aborted) {
        await delay(1800 + Math.random() * 1800, signal);
      }
    }
  }

  // New: Scroll Observer for Phase 2
  function setupScrollObserver(targets, ctx, signal) {
    const rso = document.getElementById("rso") || document.querySelector("#search") || document.querySelector("#center_col");
    if (!rso) { return; } // no host? the chaser already covers — not a permanent stall

    // Remove old sensor
    const oldSensor = document.getElementById("bt-scroll-sensor");
    if (oldSensor) oldSensor.remove();

    const sensor = document.createElement("div");
    sensor.id = "bt-scroll-sensor";
    sensor.style.height = "20px";
    sensor.style.margin = "20px 0";
    sensor.innerText = "Loading more...";
    sensor.style.color = "#888";
    sensor.style.textAlign = "center";
    rso.appendChild(sensor);

    const obs = new IntersectionObserver(async (entries) => {
      if (entries[0].isIntersecting) {
        obs.disconnect();
        sensor.innerText = "Loading...";
        try {
          // v1.2.1: القائمة اتبليت؟ بنعيد حساب الناقص بس — مفيش إعادة سحب ولا نسيان
          const live = remainingTargets();
          await fetchBatch(live.length ? live : targets, ctx, signal);
          sensor.remove();
          setStatus(`Done · ${countNative() + countInjected()} results`);
        } catch (e) {
          if (e?.name !== "AbortError") sensor.innerText = "Error loading more.";
        } finally {
          const ui = window.BT.render.getUI();
          if (ui) { ui.btn.removeAttribute("disabled"); ui.cancel.style.display = "none"; }
        }
      }
    }, { rootMargin: "2500px" }); // Trigger early (approx 2-3 screens before bottom)

    obs.observe(sensor);
    state.scrollObs = obs; // save to state to disconnect if needed
  }

  function cancelWork() {
    stopChaser();
    state.aborter?.abort();
    state.aborter = null;
    const ui = window.BT.render.getUI();
    if (ui) {
      ui.btn.removeAttribute("disabled");
      ui.cancel.style.display = "none";
      setStatus("Canceled");
    }
  }

  function cleanup() {
    if (state.obs) try { state.obs.disconnect(); } catch { }
  }

  // watch SPA URL changes
  setInterval(() => {
    if (location.href !== state.lastHref) {
      state.lastHref = location.href;
      cancelWork();
      state.seen.clear();
      state.loadedPages.clear();
      resetUI();
      boot();
    }
  }, 500);

  // export TSV from the visible blocks
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'bt-export') {
      const blocks = Array.from(document.querySelectorAll("#search #rso > *")).filter(n => n.querySelector("a h3, h3 a, .g a h3, .g h3 a"));
      const rows = [["serial", "title", "url"]];
      blocks.forEach((b, i) => {
        const a = b.querySelector(".yuRUbf a[href]") || b.querySelector("a[href]");
        const title = b.querySelector("a h3")?.textContent || "";
        const href = a?.href || "";
        rows.push([String(startOffset() + i + 1), title, href]);
      });
      const tsv = rows.map(r => r.map(x => String(x).replace(/\t/g, " ")).join("\t")).join("\n");
      sendResponse({ ok: true, tsv });
      return true;
    }
  });

  boot();
})();
