/**
 * csvkit.js — محلل CSV مصغر للـ Service Worker
 * يُستخدم لقراءة ترتيب الكلمات في شيت المستخدم (gviz CSV) حتى نكتب
 * كل ترتيب قصاد نفس كلمته في صفه — مهما كان ترتيب الشيت مختلف عن ترتيبنا.
 */

export function parseRows(text) {
  const src = String(text == null ? '' : text).replace(/^\ufeff/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const firstLine = src.split('\n')[0] || '';
  const counts = {};
  for (const d of [',', '\t', ';', '|']) {
    let inQ = false;
    let c = 0;
    for (let i = 0; i < firstLine.length; i++) {
      const ch = firstLine[i];
      if (ch === '"') { inQ = !inQ; } else if (ch === d && !inQ) { c++; }
    }
    counts[d] = c;
  }
  let delimiter = ',';
  let best = 0;
  for (const d of Object.keys(counts)) {
    if (counts[d] > best) { best = counts[d]; delimiter = d; }
  }

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
        continue;
      }
      field += ch;
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === delimiter) { row.push(field); field = ''; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim().length));
}

const HEADER_HINTS = ['keyword', 'keywords', 'كلمة', 'الكلمة', 'الكلمه', 'query', 'search term', 'البحث', 'عبارة'];

export function extractKeywords(rows) {
  if (!rows || !rows.length) { return []; }
  let column = 0;
  let body = rows;
  const firstCell = String(rows[0][0] || '').trim().toLowerCase();
  if (firstCell && HEADER_HINTS.some((h) => firstCell.indexOf(h) !== -1)) {
    const head = rows[0].map((c) => String(c || '').trim().toLowerCase());
    const found = head.findIndex((h) => HEADER_HINTS.some((hint) => h.indexOf(hint) !== -1));
    column = found >= 0 ? found : 0;
    body = rows.slice(1);
  }
  return body.map((r) => String(r[column] == null ? '' : r[column]).trim()).filter((k) => k.length > 0);
}

export function sheetCsvUrl(url) {
  const m = String(url || '').match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!m) { return ''; }
  const g = String(url).match(/[?#&]gid=(\d+)/);
  return 'https://docs.google.com/spreadsheets/d/' + m[1] + '/gviz/tq?tqx=out:csv' + (g ? '&gid=' + g[1] : '');
}
