/**
 * side-panel.js — منطق اللوحة الجانبية (ES module)
 * يربط الواجهة بالـ Service Worker: حالة حية، إعدادات، كلمات، نتائج، سجل، شارت.
 */
import { drawPositionChart } from './charts.js';

const C = globalThis.SRT_C;
const SRT = globalThis.SRT || {};
const $ = (id) => document.getElementById(id);

const t = (key) => globalThis.SRT_I18N.t(key);

function applyI18n() {
  globalThis.SRT_I18N.apply(document);
  document.title = t('panelTitle');
}

/* ------------------------------ حالة عامة ------------------------------ */
let snapshot = { config: {}, keywords: [], results: [], run: { status: 'idle' }, logs: [], stats: {} };
let configDirtyTimer = null;

const send = (type, payload) => new Promise((resolve) => {
  chrome.runtime.sendMessage(Object.assign({ type }, payload || {}), (res) => {
    if (chrome.runtime.lastError) { resolve({ __err: chrome.runtime.lastError.message }); return; }
    resolve(res || {});
  });
});

/* ------------------------------- السجل الحي ------------------------------- */
function appendLog(entry) {
  const consoleEl = $('logConsole');
  if (!consoleEl) { return; }
  const line = document.createElement('div');
  line.className = entry.level || 'info';
  line.textContent = `[${entry.time || ''}] ${entry.level || 'info'} ${entry.scope || ''}: ${entry.text || ''}`;
  consoleEl.appendChild(line);
  while (consoleEl.children.length > 250) { consoleEl.removeChild(consoleEl.firstChild); }
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

/* ------------------------------- العرض العام ------------------------------- */
const STATUS_TEXT = {
  idle: () => t('statusIdle'),
  running: () => t('statusRunning'),
  paused: () => t('statusPaused'),
  captcha: () => t('statusCaptcha'),
  stopped: () => t('statusIdle')
};

const KW_STATUS_TEXT = {
  pending: () => t('kwPending'),
  running: () => t('kwRunning'),
  done: () => t('kwDone'),
  captcha: () => t('kwCaptcha'),
  failed: () => t('kwFailed'),
  skipped: () => t('kwSkipped')
};

function renderStatus() {
  const run = snapshot.run || { status: 'idle' };
  const pill = $('statusPill');
  pill.dataset.status = run.status;
  $('statusText').textContent = (STATUS_TEXT[run.status] || STATUS_TEXT.idle)();

  const running = run.status === 'running' || run.status === 'captcha';
  $('btnStart').disabled = running;
  $('btnPause').disabled = !running;
  $('btnResume').disabled = run.status !== 'paused';
  $('btnStop').disabled = run.status === 'idle';

  const banner = $('captchaBanner');
  const showBanner = run.status === 'captcha' || (run.status === 'paused' && run.pauseReason === 'captcha-failed');
  banner.classList.toggle('hidden', !showBanner);
  if (showBanner) {
    const attempts = run.captcha && run.captcha.attempts ? run.captcha.attempts : 0;
    $('captchaAttempts').textContent = t('captchaAttemptsLabel') + ' ' + attempts;
    if (run.status === 'paused') {
      $('captchaBannerTitle').textContent = t('captchaFailedTitle');
      $('captchaBannerText').textContent = t('captchaFailedText');
    } else {
      $('captchaBannerTitle').textContent = t('captchaLiveTitle');
      $('captchaBannerText').textContent = t('captchaLiveText');
    }
  }
}

function renderStats() {
  const s = snapshot.stats || {};
  $('statChecked').textContent = s.checked || 0;
  $('statFound').textContent = s.found || 0;
  $('statAvg').textContent = s.avgPosition == null ? '—' : '#' + s.avgPosition;
  $('statCaptcha').textContent = (snapshot.run && snapshot.run.captchaSolves) || 0;
  renderRestStrip();
}

/* شريط الاستراحة التفاعلي: بيظهر بس لما استراحة فعلًا جارية دلوقتي، وعدّاد حي
   بينزل بالثواني زي شريط التحميل — مفيش «تيزر» دائم وملل. */
function renderRestStrip() {
  const strip = $('restStrip');
  const fill = $('restFill');
  const txt = $('restText');
  if (!fill || !txt || !strip) { return; }
  const run = snapshot.run || {};
  const until = run.breakUntil || 0;
  const total = Math.max(1, run.breakTotalMs || 1);
  const left = until ? Math.max(0, until - Date.now()) : 0;
  if (!until || left <= 0) {
    strip.classList.add('hidden');
    return;
  }
  strip.classList.remove('hidden');
  const cfg = snapshot.config || {};
  const withClear = Number(cfg.clearEveryN || 0) > 0;
  txt.textContent = t('restNow').replace('{s}', String(Math.ceil(left / 1000))) + (withClear ? t('restNowClear') : '');
  fill.style.width = Math.max(2, Math.round((left / total) * 100)) + '%';
}

/* إشعارات الأداة — جوه اللوحة مكان الشريط، بتختفي لوحدها بعد 45 ثانية أو بالخ ✓ */
function renderNotice() {
  const box = $('srtNotice');
  if (!box) { return; }
  const n = (snapshot.run || {}).notice;
  const fresh = n && (Date.now() - (n.ts || 0) < 45000);
  if (!fresh) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  const titleEl = $('noticeTitle');
  const textEl = $('noticeText');
  if (titleEl) { titleEl.textContent = n.title || '🔔'; }
  if (textEl) { textEl.textContent = n.text || ''; }
}

function bindRestStrip() {
  renderRestStrip();
  renderNotice();
  const tick = () => { renderRestStrip(); renderNotice(); };
  setInterval(tick, 500);
  const btn = $('noticeClose');
  if (btn) {
    btn.addEventListener('click', async () => {
      await send('srt/notice-clear', {});
      const box = $('srtNotice');
      if (box) { box.classList.add('hidden'); }
    });
  }
}

function displayPos(row) {
  // ظهر عضوياً وكمان في AI Overview → «1ai» / ظهر في الـAI بس → «ai»
  if (row.found) { return row.aiFound ? row.position + 'ai' : '#' + row.position; }
  if (row.aiFound) { return 'ai'; }
  return t('notFound');
}

function posClass(row) {
  return 'pos-badge ' + (row.found ? 'hit' : (row.aiFound ? 'ai' : 'miss'));
}

function renderKeywords() {
  const body = $('kwBody');
  body.textContent = '';
  const list = snapshot.keywords || [];
  // عدّاد دقيق: «المتفحص/الإجمالي» من مصدر الحقيقة نفسه — مش رقم إجمالي مبهم
  const cntEl = $('kwCount');
  if (cntEl) {
    const KW = C.STATUS.KW;
    const done = list.filter((k) => k.status === KW.DONE || k.status === KW.FAILED || k.status === KW.SKIPPED).length;
    cntEl.textContent = String(done) + '/' + String(list.length);
    cntEl.title = t('kwCountTip').replace('{d}', String(done)).replace('{t}', String(list.length));
  }
  if (!list.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.className = 'muted';
    td.textContent = t('kwEmpty');
    tr.appendChild(td);
    body.appendChild(tr);
    return;
  }
  for (const kw of list) {
    const tr = document.createElement('tr');

    const tdKw = document.createElement('td');
    tdKw.textContent = kw.keyword;
    if (kw.note) {
      const small = document.createElement('div');
      small.className = 'muted small';
      small.textContent = kw.note;
      tdKw.appendChild(small);
    }

    const tdStatus = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'kw-status ' + (kw.status || 'pending');
    badge.textContent = (KW_STATUS_TEXT[kw.status] || KW_STATUS_TEXT.pending)();
    tdStatus.appendChild(badge);

    const tdPos = document.createElement('td');
    const pos = document.createElement('span');
    const kwAi = kw.lastPosition == null && kw.lastAiPosition != null;
    pos.className = 'pos-badge ' + (kw.lastFound ? 'hit' : (kwAi ? 'ai' : (kw.lastCheckedAt ? 'miss' : '')));
    pos.textContent = kw.lastPosition != null ? (kw.lastAiFound || kw.lastAiPosition != null ? kw.lastPosition + 'ai' : '#' + kw.lastPosition) : (kwAi ? 'ai' : (kw.lastCheckedAt ? '—' : '·'));
    tdPos.appendChild(pos);

    const tdDel = document.createElement('td');
    const del = document.createElement('button');
    del.className = 'icon-btn';
    del.title = t('btnRemove');
    del.textContent = '✕';
    del.addEventListener('click', async () => {
      await send(C.MSG.KEYWORDS_REMOVE, { id: kw.id });
      await refresh();
    });
    tdDel.appendChild(del);

    tr.append(tdKw, tdStatus, tdPos, tdDel);
    body.appendChild(tr);
  }
}

function renderResults() {
  const body = $('resBody');
  body.textContent = '';
  const list = (snapshot.results || []).slice(0, 120);
  if (!list.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.className = 'muted';
    td.textContent = t('resEmpty');
    tr.appendChild(td);
    body.appendChild(tr);
    return;
  }
  for (const row of list) {
    const tr = document.createElement('tr');
    if (row.topHosts && row.topHosts.length) {
      tr.title = 'أول النطاقات اللي ظهرت: ' + row.topHosts.join(' | ');
    }

    const tdKw = document.createElement('td');
    tdKw.textContent = row.keyword;

    const tdPos = document.createElement('td');
    const pos = document.createElement('span');
    pos.className = posClass(row);
    pos.textContent = displayPos(row);
    tdPos.appendChild(pos);

    const tdUrl = document.createElement('td');
    const shown = row.urlDisplay || row.url;
    if (shown) {
      const a = document.createElement('a');
      a.href = row.clickUrl || row.url || '#';
      a.target = '_blank';
      a.rel = 'noreferrer';
      a.dir = 'ltr';
      a.textContent = shown.length > 52 ? shown.slice(0, 52) + '…' : shown;
      a.title = shown;
      tdUrl.appendChild(a);
    } else {
      tdUrl.textContent = '—';
    }

    const tdTime = document.createElement('td');
    const d = new Date(row.checkedAt || Date.now());
    tdTime.textContent = String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0') + ' ' +
      String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');

    tr.append(tdKw, tdPos, tdUrl, tdTime);
    body.appendChild(tr);
  }
}

function renderChart() {
  const rows = (snapshot.results || []).slice().reverse();
  const points = rows.map((r) => ({ position: r.position, ts: r.checkedAt, found: r.found }));
  const canvas = $('positionChart');
  const has = points.some((p) => typeof p.position === 'number');
  $('chartEmpty').classList.toggle('hidden', has);
  drawPositionChart(canvas, points);
}

function renderAll() {
  renderStatus();
  renderStats();
  renderKeywords();
  renderResults();
  renderChart();
}

/* ------------------------------- الإعدادات ------------------------------- */
const CONFIG_FIELDS = [
  ['cfgDomain', 'storeDomain', 'string'],
  ['cfgName', 'storeName', 'string'],
  ['cfgMatch', 'matchMode', 'string'],
];

function fillConfigForm(config) {
  for (const [id, key, kind] of CONFIG_FIELDS) {
    const el = $(id);
    if (!el) { continue; }
    const value = config[key];
    if (kind === 'bool') { el.checked = !!value; }
    else { el.value = value == null ? '' : value; }
  }
}

function readConfigForm() {
  const patch = {};
  for (const [id, key, kind] of CONFIG_FIELDS) {
    const el = $(id);
    if (!el) { continue; }
    if (kind === 'bool') { patch[key] = el.checked; }
    else if (kind === 'number') { patch[key] = parseInt(el.value, 10) || 0; }
    else { patch[key] = el.value.trim(); }
  }
  return patch;
}

function bindConfigForm() {
  for (const [id] of CONFIG_FIELDS) {
    const el = $(id);
    if (!el) { continue; }
    const evt = el.tagName === 'INPUT' && el.type === 'checkbox' ? 'change' : 'input';
    el.addEventListener(evt, () => {
      clearTimeout(configDirtyTimer);
      configDirtyTimer = setTimeout(async () => {
        await send(C.MSG.SET_CONFIG, { patch: readConfigForm() });
      }, 350);
    });
    if (el.tagName === 'SELECT') {
      el.addEventListener('change', async () => {
        await send(C.MSG.SET_CONFIG, { patch: readConfigForm() });
      });
    }
  }
}

/* ------------------------------ الكلمات المفتاحية ------------------------------ */
function parseKeywordsInput(text) {
  const raw = String(text || '');
  if (!raw.trim()) { return []; }
  // إن احتوى فواصل/تبويبات نمرره عبر محلل CSV لاستخراج العمود الأول
  if (/[,;\t]/.test(raw)) {
    const parsed = SRT.csv ? SRT.csv.parse(raw) : { rows: raw.split('\n').map((l) => [l]) };
    const extracted = SRT.csv ? SRT.csv.extractKeywords(parsed.rows) : { keywords: parsed.rows.map((r) => r[0]) };
    return extracted.keywords;
  }
  return raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

async function addFromInput() {
  const keywords = parseKeywordsInput($('kwInput').value);
  if (!keywords.length) { alert(t('kwNone')); return; }
  const res = await send(C.MSG.KEYWORDS_ADD, { keywords });
  if (!res || res.__err || res.error) {
    alert(t('kwAddFail') + ': ' + ((res && (res.error || res.__err)) || '?'));
    return;
  }
  $('kwInput').value = '';
  await refresh();
  // بدون اشعار: عدّاد الكلمات فوق الجزء نفسه هو الرد — دايما صحيح وحي
}

async function importCsvFile(file) {
  const text = await file.text();
  const parsed = SRT.csv.parse(text);
  const extracted = SRT.csv.extractKeywords(parsed.rows);
  if (!extracted.keywords.length) { return; }
  await send(C.MSG.KEYWORDS_ADD, { keywords: extracted.keywords });
  await refresh();
}

/* --------------------------------- النتائج --------------------------------- */

/* ترتيب التصدير دايماً = ترتيب الكلمات اللي المستخدم حاطها في القائمة (مش العكس).
   كل كلمة مرة واحدة بآخر نتيجة ليها، واللي ملهاش بوزيشن (أو لسه متفحصتش) بتاخد
   «—» الشرطة نفسها اللي باينة في الجدول — عشان الشيت يبقى صورة طبق الأصل من اللوحة. */
function exportEntriesInUserOrder() {
  const byKw = new Map();
  for (const r of (snapshot.results || [])) { // المخزّن: الأحدث الأول — أول ظهور للواحد = الأحدث
    const key = String((r && r.keyword) || '').trim().toLowerCase();
    if (key && !byKw.has(key)) { byKw.set(key, r); }
  }
  const list = (snapshot.keywords || []).filter((k) => k && String(k.keyword || '').trim());
  if (list.length) {
    return list.map((k) => {
      const key = String(k.keyword).trim().toLowerCase();
      return { keyword: String(k.keyword).trim(), result: byKw.get(key) || null };
    });
  }
  // القائمة اتلمست؟ نرجع لآخر نتيجة لكل كلمة بترتيب الفحص الأصلي (الأقدم الأول)
  return Array.from(byKw.entries()).map((e) => ({ keyword: e[1].keyword, result: e[1] })).reverse();
}

/* خانة الترتيب الموحدة: «1ai» / «4» / «ai» / «—» — نفس شكل اللوحة بالظبط */
function posCellForExport(r) {
  if (!r) { return '—'; }
  const pos = Number(r.position);
  const okPos = r.position != null && Number.isFinite(pos);
  if (r.found) { return okPos ? (r.aiFound ? pos + 'ai' : String(pos)) : (r.aiFound ? 'ai' : '—'); }
  return r.aiFound ? 'ai' : '—';
}

function resultRowsForExport() {
  const header = [t('thKeyword'), t('thPosition'), 'found', 'ai_overview', 'url', 'title', 'total', 'checked_at'];
  const rows = exportEntriesInUserOrder().map((e) => {
    const r = e.result || {};
    return [
      e.keyword,
      posCellForExport(e.result),
      r.found ? 'yes' : (r.aiFound ? 'ai' : 'no'),
      r.aiFound ? (r.aiPosition != null ? r.aiPosition : '') : '',
      r.urlDisplay || r.url || '',
      r.title || '',
      r.total || 0,
      r.checkedAt ? new Date(r.checkedAt).toISOString() : ''
    ];
  });
  return [header].concat(rows);
}

async function makeXlsx(silent) {
  const entries = exportEntriesInUserOrder();
  if (!entries.some((e) => e.result)) {
    if (!silent) { alert(t('copyEmpty')); }
    return;
  }
  const rows = [[t('thKeyword'), t('thPosition'), 'AI', 'محلي', 'URL', t('thTime')]];
  entries.forEach((e) => {
    const r = e.result || {};
    rows.push([
      e.keyword,
      posCellForExport(e.result),
      r.aiFound ? (r.aiPosition != null ? r.aiPosition : 'AI') : '',
      r.localFound ? '#' + r.localPosition : '',
      r.url || '',
      r.checkedAt ? new Date(r.checkedAt).toLocaleString('ar-SA') : ''
    ]);
  });
  const bytes = SRT.xlsx.buildXlsx(rows, 'الترتيب');
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'srt-ranks-' + new Date().toISOString().slice(0, 10) + '.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  if (!silent) { alert(t('makeXlsxOk')); }
}

async function exportCsv() {
  if (!(snapshot.results || []).length) { alert(t('copyEmpty')); return; }
  const rows = resultRowsForExport();
  const csv = SRT.csv.withBom(SRT.csv.build(rows, ','));
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'srt-results-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

async function copyTsv() {
  const entries = exportEntriesInUserOrder();
  const hasData = entries.some((e) => e.result);
  if (!entries.length || !hasData) { alert(t('copyEmpty')); return; }
  const rows = entries.map((e) => [e.keyword, posCellForExport(e.result)]);
  const tsv = SRT.csv.toTsv(rows);
  try {
    await navigator.clipboard.writeText(tsv);
    alert(t('copyDone'));
  } catch (_) {
    // fallback: textarea مؤقت — ولو هو كمان فشل نقول بوضوح بدل ما نكذب «اتنسخ»
    let ok = false;
    try {
      const ta = document.createElement('textarea');
      ta.value = tsv;
      document.body.appendChild(ta);
      ta.select();
      ok = document.execCommand('copy');
      ta.remove();
    } catch (__) { ok = false; }
    alert(ok ? t('copyDone') : t('copyFail'));
  }
}

/* --------------------- تنزيل الشيت تلقائياً عند انتهاء الجولة --------------------- */
let lastFinishedAt = null;
function maybeAutoXlsx(run, config) {
  if (!run || run.status !== 'idle' || !run.finishedAt) { return; }
  if (lastFinishedAt === run.finishedAt) { return; }
  lastFinishedAt = run.finishedAt;
  if (!config || config.autoXlsx === false) { return; }
  if (!(snapshot.results || []).length) { return; }
  makeXlsx(true);
  appendLog({ level: 'info', time: new Date().toTimeString().slice(0, 8), scope: 'panel', text: '📊 اتجهز شيت Excel بالترتيب واتحمّل لوحده' });
}

/* --------------------------------- التحديث --------------------------------- */
async function refresh() {
  const res = await send(C.MSG.GET_STATE);
  if (res && res.ok) {
    snapshot = res;
    fillConfigForm(snapshot.config || {});
    renderAll();
  }
}

/* --------------------------------- الإقلاع --------------------------------- */
async function main() {
  globalThis.SRT_I18N.init(document, applyI18n);
  $('btnLang').addEventListener('click', () => {
    const next = globalThis.SRT_I18N.lang === 'ar' ? 'en' : 'ar';
    globalThis.SRT_I18N.setLang(next, document);
    applyI18n();
    renderAll();
  });
  const vt = $('versionTag');
  if (vt) { vt.textContent = 'v' + C.VERSION; }

  // Keep-Alive: يبقي الـ Service Worker حياً طوال فتح اللوحة
  SRT.msg.connectKeepalive('srt-sidepanel');

  // ⚙️ تبويبات الأدوات المدمجة (الرئيسية / الموقع / النتائج)
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.tab-pane').forEach((pane) => {
        pane.classList.toggle('hidden', pane.id !== btn.dataset.pane);
      });
      window.dispatchEvent(new Event('resize')); // إعادة رسم الشارت عند العودة للرئيسية
    });
  });

  // ⚠️ تحذير يظهر عند كل فتحة للوحة — على طول في البداية
  $('warnOverlay').classList.remove('hidden');
  $('btnWarnOk').addEventListener('click', () => {
    $('warnOverlay').classList.add('hidden');
  });

  bindConfigForm();

  $('btnStart').addEventListener('click', async () => {
    const res = await send(C.MSG.QUEUE_START);
    if (res && res.ok === false && res.reason === 'no-target') { alert(t('errNoTarget')); }
    if (res && res.ok === false && res.reason === 'no-keywords') { alert(t('errNoKeywords')); }
    if (res && res.ok === false && res.reason === 'daily-cap') { alert(t('errDailyCap')); }
    await refresh();
  });
  $('btnPause').addEventListener('click', async () => { await send(C.MSG.QUEUE_PAUSE, { reason: 'user' }); await refresh(); });
  $('btnResume').addEventListener('click', async () => { await send(C.MSG.QUEUE_RESUME); await refresh(); });
  $('btnStop').addEventListener('click', async () => { await send(C.MSG.QUEUE_STOP); await refresh(); });

  $('btnAddKw').addEventListener('click', addFromInput);
  $('btnImportCsv').addEventListener('click', () => $('csvFile').click());
  $('csvFile').addEventListener('change', (ev) => {
    const file = ev.target.files && ev.target.files[0];
    if (file) { importCsvFile(file); }
    ev.target.value = '';
  });
  $('btnClearKw').addEventListener('click', async () => {
    if (confirm(t('confirmClearKw'))) { await send(C.MSG.KEYWORDS_CLEAR); await refresh(); }
  });

  bindRestStrip();
  $('btnMakeXlsx').addEventListener('click', makeXlsx);
  $('btnExportCsv').addEventListener('click', exportCsv);
  $('btnCopyTsv').addEventListener('click', copyTsv);
  $('btnClearRes').addEventListener('click', async () => {
    if (confirm(t('confirmClearRes'))) { await send(C.MSG.RESULTS_CLEAR); await refresh(); }
  });
  $('btnClearLogs').addEventListener('click', () => { $('logConsole').textContent = ''; });
  $('btnFocusCaptcha').addEventListener('click', async () => {
    const tabId = snapshot.run && snapshot.run.captcha ? snapshot.run.captcha.tabId : null;
    if (tabId) {
      try {
        await chrome.tabs.update(tabId, { active: true });
        const tab = await chrome.tabs.get(tabId);
        if (tab && tab.windowId) { await chrome.windows.update(tab.windowId, { focused: true }); }
      } catch (_) {}
    }
  });

  // بث الحالة من الـ Service Worker
  chrome.runtime.onMessage.addListener((message) => {
    if (!message || !message.type) { return; }
    if (message.type === C.MSG.STATE_BROADCAST) {
      snapshot = Object.assign({}, snapshot, message);
      maybeAutoXlsx(message.run, snapshot.config);
      renderAll();
    } else if (message.type === C.MSG.LOG) {
      appendLog(message);
    }
  });

  await refresh();
  (snapshot.logs || []).forEach(appendLog);
  window.addEventListener('resize', renderChart);
}

main().catch((err) => console.error('[SRT][panel]', err));
