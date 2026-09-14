/**
 * xlsxkit.js — مولّد ملفات Excel حقيقية (XLSX) بدون أي مكتبة خارجية
 * ZIP (store) + الحد الأدنى من OOXML: ورقة واحدة بخلايا نصية/رقمية.
 * يُستخدم في اللوحة: "اعمل شيت بالترتيب" ← ملف .xlsx يفتح في Excel/Sheets.
 */
(function (global) {
  'use strict';

  const CRC_TABLE = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) { c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); }
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(u8) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < u8.length; i++) { c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  const enc = new TextEncoder();

  /** ZIP بدون ضغط (store) — كافٍ وصغير لجداول النتائج */
  function zipStore(files) {
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = (((now.getFullYear() - 1980) & 0x7f) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const chunks = [];
    const central = [];
    let offset = 0;

    for (const f of files) {
      const nameB = enc.encode(f.name);
      const crc = crc32(f.data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true);
      lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, 0, true);
      lh.setUint16(10, dosTime, true);
      lh.setUint16(12, dosDate, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, f.data.length, true);
      lh.setUint32(22, f.data.length, true);
      lh.setUint16(26, nameB.length, true);
      lh.setUint16(28, 0, true);
      chunks.push(new Uint8Array(lh.buffer), nameB, f.data);
      central.push({ nameB: nameB, crc: crc, size: f.data.length, offset: offset });
      offset += 30 + nameB.length + f.data.length;
    }

    let cdSize = 0;
    for (const c of central) {
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true);
      ch.setUint16(4, 20, true);
      ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true);
      ch.setUint16(12, dosTime, true);
      ch.setUint16(14, dosDate, true);
      ch.setUint32(16, c.crc, true);
      ch.setUint32(20, c.size, true);
      ch.setUint32(24, c.size, true);
      ch.setUint16(28, c.nameB.length, true);
      ch.setUint32(42, c.offset, true);
      chunks.push(new Uint8Array(ch.buffer), c.nameB);
      cdSize += 46 + c.nameB.length;
    }

    const eocd = new DataView(new ArrayBuffer(22));
    eocd.setUint32(0, 0x06054b50, true);
    eocd.setUint16(8, central.length, true);
    eocd.setUint16(10, central.length, true);
    eocd.setUint32(12, cdSize, true);
    eocd.setUint32(16, offset, true);
    chunks.push(new Uint8Array(eocd.buffer));

    const total = chunks.reduce((a, b) => a + b.length, 0);
    const out = new Uint8Array(total);
    let p = 0;
    for (const a of chunks) { out.set(a, p); p += a.length; }
    return out;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function colRef(ci) {
    let s = '';
    let n = ci + 1;
    while (n > 0) {
      const rem = (n - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  function sheetXml(rows) {
    let r = '';
    (rows || []).forEach((row, ri) => {
      r += '<row r="' + (ri + 1) + '">';
      (row || []).forEach((cell, ci) => {
        const ref = colRef(ci) + (ri + 1);
        if (typeof cell === 'number' && isFinite(cell)) {
          r += '<c r="' + ref + '"><v>' + cell + '</v></c>';
        } else {
          r += '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' + esc(cell) + '</t></is></c>';
        }
      });
      r += '</row>';
    });
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
      r + '</sheetData></worksheet>';
  }

  function buildXlsx(rows, sheetName) {
    const name = sheetName || 'Results';
    const files = [
      {
        name: '[Content_Types].xml',
        data: enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>')
      },
      {
        name: '_rels/.rels',
        data: enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
      },
      {
        name: 'xl/workbook.xml',
        data: enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' + esc(name) + '" sheetId="1" r:id="rId1"/></sheets></workbook>')
      },
      {
        name: 'xl/_rels/workbook.xml.rels',
        data: enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>')
      },
      {
        name: 'xl/worksheets/sheet1.xml',
        data: enc.encode(sheetXml(rows))
      }
    ];
    return zipStore(files);
  }

  global.SRT = Object.assign(global.SRT || {}, { xlsx: { buildXlsx: buildXlsx, crc32: crc32 } });
})(globalThis);
