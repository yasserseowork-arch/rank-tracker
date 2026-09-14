/**
 * sheets-writer.js — كاتب النتائج داخل Google Sheets (بدون API)
 *
 * الاستراتيجية (Best-effort عبر واجهة الشيت نفسها):
 *  1) ننتظر جاهزية الشبكة (canvas).
 *  2) نوجّه المؤشر لخلية البداية عبر "مربع الاسم" (Name box) + Enter.
 *  3) نبث حدث لصق (ClipboardEvent ببيانات TSV) فتلتصق القيم في العمود
 *     كما لو لصقتها بيدك — بدون لمس عمود الكلمات.
 *  إن فشل أي خطوة: نبلغ المحرك ليوجّهك لزر "نسخ للصق في الشيت".
 */
(function () {
  'use strict';
  const C = globalThis.SRT_C;
  const D = globalThis.SRT;
  if (!C || !D) { return; }
  if (location.hostname !== 'docs.google.com' || location.pathname.indexOf('/spreadsheets/') !== 0) { return; }
  if (globalThis.__SRT_SHEET_BOOTED__) { return; }
  globalThis.__SRT_SHEET_BOOTED__ = true;

  const NAME_BOX = [
    'input[aria-label="Name box" i]',
    'input[aria-label*="Name box" i]',
    'input[aria-label*="مربع الاسم"]',
    '#docs-namebox-container input',
    'input[aria-label*="Name Box" i]',
    'input[aria-label*="صندوق الاسم"]'
  ];

  async function writeTsv(tsv, startCell) {
    const ready = await D.waitFor(
      () => D.qs('canvas.griddoc') || D.qs('.grid-scrollable-wrapper') || D.qs('canvas'),
      { timeoutMs: 25000, intervalMs: 500, desc: 'sheet-grid' }
    );
    if (!ready) { return { ok: false, reason: 'sheet-not-ready' }; }

    const nb = D.first(NAME_BOX);
    if (!nb) { return { ok: false, reason: 'no-name-box' }; }
    try { nb.focus({ preventScroll: true }); } catch (_) {}
    const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    if (proto && proto.set) { proto.set.call(nb, startCell); } else { nb.value = startCell; }
    nb.dispatchEvent(new Event('input', { bubbles: true }));
    nb.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    nb.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    await D.humanSleep(700, 200);

    try {
      const dt = new DataTransfer();
      dt.setData('text/plain', tsv);
      const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
      const target = document.activeElement || document.body;
      target.dispatchEvent(ev);
      document.dispatchEvent(ev);
      await D.humanSleep(900, 250);
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: String(err && err.message ? err.message : err) };
    }
  }

  D.msg.on(C.MSG.SHEET_CMD_WRITE, async (m) => writeTsv(m.tsv || '', m.startCell || 'B1'));
})();
