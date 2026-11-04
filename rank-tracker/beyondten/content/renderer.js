
// content/renderer.js (import native blocks; add serial numbers only)
// Developed by Ayub Ansary - SEO Specialist (https://ayubansary.com)
// Helping businesses grow beyond limitations
window.BT = window.BT || {};
(function () {
  function pickResultsColumn() {
    const search = document.querySelector("#search");
    if (search) return search;
    return document.querySelector("#center_col") ||
      document.querySelector("main#main") ||
      document.body;
  }
  function pickRso() {
    return document.querySelector("#search #rso") || pickResultsColumn();
  }

  let ui = null;
  function mountUI(target, disabled) {
    const search = pickResultsColumn();

    // Floating Toolbar attached to body
    let barHost = document.getElementById("bt-bar-host");
    if (!barHost) {
      barHost = document.createElement("div");
      barHost.id = "bt-bar-host";
      document.body.appendChild(barHost);
    }
    const barShadow = barHost.shadowRoot || barHost.attachShadow({ mode: "closed" });
    barShadow.innerHTML = "";
    const barStyle = document.createElement("style");
    barStyle.textContent = `
      :host {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 2147483647; /* Max z-index to stay on top */
        font-family: Google Sans, Roboto, arial, sans-serif;
      }
      .bar {
         display: flex;
         gap: 8px;
         align-items: center;
         padding: 8px 12px;
         background: var(--bg, #fff);
         border: 1px solid var(--border, #ccc);
         border-radius: 24px;
         box-shadow: 0 4px 6px rgba(0,0,0,0.1);
         transition: opacity 0.3s;
      }
      /* Variables for colors */
      :host { --bg: #fff; --text: #333; --border: #dadce0; }
      @media (prefers-color-scheme: dark) {
        :host { --bg: #202124; --text: #bdc1c6; --border: #3c4043; }
      }
      
      .btn, .cancel {
        border: none;
        background: transparent;
        color: var(--text);
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
      }
      .btn:hover, .cancel:hover { background: rgba(128,128,128,0.1); }
      .btn[disabled] { opacity: 0.5; cursor: wait; }
      
      .status {
        font-size: 13px;
        color: var(--text);
        margin-left: 4px;
        opacity: 0.8;
      }
    `;
    barShadow.appendChild(barStyle);
    const bar = document.createElement("div"); bar.className = "bar";
    const btn = document.createElement("button"); btn.className = "btn"; btn.textContent = `Show ${target} results`; if (disabled) btn.setAttribute("disabled", "true");
    const cancel = document.createElement("button"); cancel.className = "cancel"; cancel.textContent = "Cancel"; cancel.style.display = "none";
    const status = document.createElement("span"); status.className = "status";
    bar.appendChild(btn); bar.appendChild(cancel); bar.appendChild(status);
    barShadow.appendChild(bar);

    ui = { barShadow, btn, cancel, status };
    return ui;
  }
  function getUI() { return ui; }
  function resetUI() { if (ui) { ui.barShadow.innerHTML = ""; } }
  function setStatus(msg) { const u = getUI(); if (u && u.status) u.status.textContent = msg; }

  // Count only organic blocks that contain a blue-link
  function findOrganicBlocksInPage() {
    // Structural check only
    const all = Array.from(document.querySelectorAll("#search #rso > *"));
    return all.filter(k => {
      if (k.tagName === "SCRIPT" || k.tagName === "STYLE") return false;
      return k.querySelector("a h3") || k.querySelector("h3 a");
    });
  }
  function countNative() { return findOrganicBlocksInPage().length; }
  function countInjected() { return document.querySelectorAll(".bt-imported[data-bt='1']").length; }

  // Try to place a small serial number in the breadcrumb/URL row; otherwise before the title.
  function stampSerial(blockEl, num) {
    // Remove any previous serial
    blockEl.querySelectorAll(".bt-serial").forEach(x => x.remove());
    const serial = document.createElement("span");
    serial.className = "bt-serial";
    serial.textContent = `${num}.`;

    // Default styling (absolute positioning to avoid layout shift)
    Object.assign(serial.style, {
      position: "absolute",
      left: "-24px",
      top: "2px",
      color: "var(--color-citations, #4d5156)", // Google's grey
      userSelect: "none",
      pointerEvents: "none",
      font: "inherit",
      fontSize: "12px"
    });
    // Dark mode adjustment for the serial itself if possible, 
    // but since it's injected into main DOM, it inherits page styles.

    try {
      // 1. Structural Strategy: Find the Title Link
      const titleLink = blockEl.querySelector("a h3")?.parentElement || blockEl.querySelector("h3 a");

      // If we found a title, try to find the "Citation/Breadcrumb" row above it.
      // Usually it's the previous sibling of the title's container.
      let targetContainer = null;

      if (titleLink) {
        // Walk up to find the main container of the title
        let p = titleLink.parentElement;
        while (p && p !== blockEl && p.textContent.length < 200) {
          // Looking for the "cite" or "breadcrumb" container which is usually small text
          const cite = p.querySelector("cite");
          if (cite) {
            targetContainer = cite;
            break;
          }
          p = p.parentElement;
        }
      }

      // If we found a breadcrumb container, append nicely
      if (targetContainer) {
        serial.style.position = "relative";
        serial.style.left = "auto";
        serial.style.top = "auto";
        serial.style.marginRight = "6px";
        targetContainer.insertBefore(serial, targetContainer.firstChild);
        return;
      }

      // Fallback: Absolute position relative to the block itself
      const csb = getComputedStyle(blockEl);
      if (csb.position === "static") blockEl.style.position = "relative";
      blockEl.appendChild(serial);

    } catch (e) {
      // safety net
    }
  }

  function appendTopLevelItems(blocks) {
    const rso = pickRso();
    const frag = document.createDocumentFragment();
    blocks.forEach(b => {
      const imported = document.importNode(b, true);
      imported.classList.add("bt-imported");
      imported.setAttribute("data-bt", "1");
      frag.appendChild(imported);
    });
    rso.appendChild(frag);
  }

  function renumberAll(offset) {
    // ⚙️ الترقيم المرئي معطّل بقرار المستخدم (SERP Counter هو المسؤول عن الترقيم)
    // — جلب الصفحات ودمج النتائج حتى 100 يظل يعمل كما هو بدون أرقام.
    void offset;
  }

  window.BT.render = {
    mountUI, getUI, resetUI, setStatus,
    countNative, countInjected,
    appendTopLevelItems, renumberAll, pickResultsColumn
  };
})();
