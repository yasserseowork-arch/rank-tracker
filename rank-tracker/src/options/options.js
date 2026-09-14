/**
 * options.js — صفحة الإعدادات المتقدمة + النسخ الاحتياطي
 */
const C = globalThis.SRT_C;
const $ = (id) => document.getElementById(id);

const send = (type, payload) => new Promise((resolve) => {
  chrome.runtime.sendMessage(Object.assign({ type }, payload || {}), (res) => {
    if (chrome.runtime.lastError) { resolve({ __err: chrome.runtime.lastError.message }); return; }
    resolve(res || {});
  });
});

const FIELDS = [
  ['cfgGl', 'gl', 'string'],
  ['cfgHl', 'hl', 'string'],
  ['cfgNum', 'num', 'number'],
  ['cfgDailyCap', 'maxChecksPerDay', 'number'],
  ['cfgJitter', 'jitterMs', 'number'],
  ['cfgCooldownEvery', 'cooldownEvery', 'number'],
  ['cfgCooldownMs', 'cooldownMs', 'number'],
  ['cfgCapAttempts', 'captchaMaxAttempts', 'number'],
  ['cfgCapTimeout', 'captchaAttemptTimeoutMs', 'number'],
  ['cfgCapGap', 'captchaGapMs', 'number'],
  ['cfgForeground', 'foregroundTab', 'bool'],
  ['cfgReuse', 'reuseTab', 'bool'],
  ['cfgPauseCap', 'pauseOnCaptchaFail', 'bool'],
  ['cfgAutoResume', 'autoResumeOnManualSolve', 'bool'],
  ['cfgClearRun', 'clearBeforeRun', 'bool'],
  ['cfgMaps', 'mapsCheck', 'bool'],
  ['cfgMaxWait', 'maxWaitResultsMs', 'number'],
  ['cfgBatchSettle', 'batchSettleMs', 'number'],
  ['cfgRescan', 'rescanMs', 'number'],
  ['cfgSettle', 'settleMs', 'number'],
  ['cfgVerbose', 'verbose', 'bool']
];

const t = (k) => globalThis.SRT_I18N.t(k);
function applyI18n() {
  globalThis.SRT_I18N.apply(document);
  document.title = t('optionsTitle');
}

async function load() {
  const res = await send(C.MSG.GET_CONFIG);
  const config = res.config || {};
  for (const [id, key, kind] of FIELDS) {
    const el = $(id);
    if (!el) { continue; }
    if (kind === 'bool') { el.checked = !!config[key]; }
    else { el.value = config[key] == null ? '' : config[key]; }
  }
  $('aboutText').textContent =
    t('aboutVersion') + ' ' + C.VERSION +
    ' — MV3 / Service Worker / Side Panel / Content Scripts multi-frame.';
}

function bind() {
  for (const [id] of FIELDS) {
    const el = $(id);
    if (!el) { continue; }
    el.addEventListener('change', async () => {
      const patch = {};
      for (const [fid, key, kind] of FIELDS) {
        const fel = $(fid);
        if (!fel) { continue; }
        if (kind === 'bool') { patch[key] = fel.checked; }
        else if (kind === 'number') { patch[key] = parseInt(fel.value, 10) || 0; }
        else { patch[key] = String(fel.value || '').trim(); }
      }
      await send(C.MSG.SET_CONFIG, { patch });
    });
  }

  $('btnExportJson').addEventListener('click', async () => {
    const res = await send(C.MSG.GET_STATE);
    const payload = {
      exportedAt: new Date().toISOString(),
      version: C.VERSION,
      config: res.config,
      keywords: res.keywords,
      results: res.results
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'srt-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  $('btnImportJson').addEventListener('click', () => $('jsonFile').click());
  $('jsonFile').addEventListener('change', async (ev) => {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!file) { return; }
    try {
      const data = JSON.parse(await file.text());
      if (data.config) { await send(C.MSG.SET_CONFIG, { patch: data.config }); }
      if (Array.isArray(data.keywords)) { await send(C.MSG.KEYWORDS_SET, { keywords: data.keywords }); }
      alert(chrome.i18n.getMessage('importDone') || 'تم الاستيراد');
      await load();
    } catch (err) {
      alert((chrome.i18n.getMessage('importFail') || 'فشل الاستيراد') + ': ' + (err && err.message));
    }
  });

  $('btnResetAll').addEventListener('click', async () => {
    if (!confirm(chrome.i18n.getMessage('confirmReset') || 'تصفير كل البيانات؟')) { return; }
    await chrome.storage.local.clear();
    if (chrome.storage.session) { await chrome.storage.session.clear(); }
    await load();
  });
}

globalThis.SRT_I18N.init(document, applyI18n);
document.getElementById('btnLang').addEventListener('click', () => {
  const next = globalThis.SRT_I18N.lang === 'ar' ? 'en' : 'ar';
  globalThis.SRT_I18N.setLang(next, document);
  applyI18n();
});
load();
bind();
