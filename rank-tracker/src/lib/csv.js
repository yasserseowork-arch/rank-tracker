/**
 * csv.js — محلل/بانئ CSV و TSV كامل (Classic script)
 * يدعم: الاقتباسات، الفواصل المضمّنة، الأسطر الجديدة داخل الاقتباس،
 * اكتشاف المحدد تلقائياً، BOM، ورؤوس الأعمدة العربية/الإنجليزية.
 */
(function (global) {
  'use strict';

  const DELIMITERS = [',', '\t', ';', '|'];

  function stripBom(text) {
    let t = String(text == null ? '' : text);
    if (t.charCodeAt(0) === 0xfeff) { t = t.slice(1); }
    return t;
  }

  /** عدّ الفواصل خارج الاقتباس في عينة أسطر لتخمين المحدد */
  function detectDelimiter(text) {
    const sample = String(text).split(/\r?\n/).slice(0, 12).join('\n');
    let best = ',';
    let bestScore = -1;
    for (const d of DELIMITERS) {
      let count = 0;
      let inQuotes = false;
      for (let i = 0; i < sample.length; i++) {
        const ch = sample[i];
        if (ch === '"') { inQuotes = !inQuotes; }
        else if (ch === d && !inQuotes) { count++; }
      }
      const lines = sample.split(/\r?\n/).filter((l) => l.trim().length);
      const score = lines.length ? count / lines.length : 0;
      if (count > 0 && score >= 1 && score > bestScore) { bestScore = score; best = d; }
    }
    return best;
  }

  /**
   * تحليل نص CSV إلى مصفوفة صفوف.
   * @returns {{rows: string[][], delimiter: string}}
   */
  function parse(text, opts) {
    const options = opts || {};
    const src = stripBom(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const delimiter = options.delimiter || detectDelimiter(src);
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    let i = 0;

    const pushField = () => { row.push(field); field = ''; };
    const pushRow = () => { pushField(); rows.push(row); row = []; };

    while (i < src.length) {
      const ch = src[i];
      if (inQuotes) {
        if (ch === '"') {
          if (src[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += ch; i++; continue;
      }
      if (ch === '"') { inQuotes = true; i++; continue; }
      if (ch === delimiter) { pushField(); i++; continue; }
      if (ch === '\n') { pushRow(); i++; continue; }
      field += ch; i++;
    }
    if (field.length || row.length) { pushRow(); }

    const clean = rows.filter((r) => r.some((c) => String(c).trim().length));
    return { rows: clean, delimiter: delimiter };
  }

  function escapeCell(value, delimiter) {
    const s = value == null ? '' : String(value);
    const needs = s.indexOf(delimiter) !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1 || s.indexOf('\r') !== -1;
    return needs ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function build(rows, delimiter) {
    const d = delimiter || ',';
    return (rows || [])
      .map((r) => (r || []).map((c) => escapeCell(c, d)).join(d))
      .join('\r\n');
  }

  /** BOM حتى تفتح Excel الملفات العربية بدون تشفير */
  function withBom(csvText) {
    return '\ufeff' + csvText;
  }

  /** تحويل صفوف إلى TSV جاهز للصق داخل Google Sheets */
  function toTsv(rows) {
    return (rows || []).map((r) => (r || []).map((c) => String(c == null ? '' : c).replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n');
  }

  const HEADER_HINTS = ['keyword', 'keywords', 'كلمة', 'الكلمة', 'الكلمه', 'كلمه', 'query', 'search term', 'البحث', 'عبارة'];

  /** هل الصف الأول يبدو رأس أعمدة؟ */
  function looksLikeHeader(firstRow) {
    if (!firstRow || !firstRow.length) { return false; }
    const firstCell = String(firstRow[0] || '').trim().toLowerCase();
    if (!firstCell) { return false; }
    return HEADER_HINTS.some((h) => firstCell.indexOf(h) !== -1);
  }

  /**
   * استخراج عمود الكلمات المفتاحية من صفوف CSV.
   * يبحث عن عمود رأسه يشير لكلمة مفتاحية، وإلا العمود الأول غير الفارغ.
   */
  function extractKeywords(rows) {
    if (!rows || !rows.length) { return { keywords: [], header: false, column: 0 }; }
    let column = 0;
    let header = false;
    if (looksLikeHeader(rows[0])) {
      header = true;
      const head = rows[0].map((c) => String(c || '').trim().toLowerCase());
      const found = head.findIndex((h) => HEADER_HINTS.some((hint) => h.indexOf(hint) !== -1));
      column = found >= 0 ? found : 0;
    }
    const body = header ? rows.slice(1) : rows;
    const keywords = body
      .map((r) => String(r[column] == null ? '' : r[column]).trim())
      .filter((k) => k.length > 0);
    return { keywords: keywords, header: header, column: column };
  }

  global.SRT = Object.assign(global.SRT || {}, {
    csv: { parse, build, toTsv, withBom, detectDelimiter, extractKeywords, looksLikeHeader, stripBom }
  });
})(globalThis);
