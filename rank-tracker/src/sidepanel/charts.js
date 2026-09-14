/**
 * charts.js — رسم بياني خفيف على Canvas بدون أي مكتبات خارجية
 * منحنى الترتيب عبر الفحوصات (محور Y معكوس: الأعلى = ترتيب أفضل)
 */

export function drawPositionChart(canvas, points, opts) {
  if (!canvas || !canvas.getContext) { return; }
  const options = opts || {};
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 640;
  const cssH = canvas.clientHeight || 150;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const pad = { top: 14, right: 14, bottom: 22, left: 30 };
  const w = cssW - pad.left - pad.right;
  const h = cssH - pad.top - pad.bottom;

  // شبكة خلفية
  ctx.strokeStyle = 'rgba(143,161,189,.16)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (h / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + w, y);
    ctx.stroke();
  }

  const data = (points || []).filter((p) => typeof p.position === 'number');
  if (!data.length) { return; }

  const maxY = options.maxY || Math.max(10, ...data.map((p) => p.position));
  const minY = 1;
  const xFor = (i) => pad.left + (data.length === 1 ? w / 2 : (w / (data.length - 1)) * i);
  const yFor = (pos) => pad.top + h - ((maxY - pos) / (maxY - minY)) * h;

  // تدرج المساحة تحت المنحنى
  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + h);
  grad.addColorStop(0, 'rgba(34,197,94,.32)');
  grad.addColorStop(1, 'rgba(34,197,94,0)');
  ctx.beginPath();
  ctx.moveTo(xFor(0), yFor(data[0].position));
  data.forEach((p, i) => ctx.lineTo(xFor(i), yFor(p.position)));
  ctx.lineTo(xFor(data.length - 1), pad.top + h);
  ctx.lineTo(xFor(0), pad.top + h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // المنحنى
  ctx.beginPath();
  data.forEach((p, i) => {
    const x = xFor(i);
    const y = yFor(p.position);
    if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); }
  });
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // النقاط
  data.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(xFor(i), yFor(p.position), 3, 0, Math.PI * 2);
    ctx.fillStyle = p.found === false ? '#ef4444' : '#bbf7d0';
    ctx.fill();
  });

  // تسميات المحور Y
  ctx.fillStyle = 'rgba(143,161,189,.9)';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const value = Math.round(maxY - ((maxY - minY) / 4) * i);
    const y = pad.top + (h / 4) * i;
    ctx.fillText('#' + value, pad.left - 5, y + 3);
  }

  // تسميات X (وقت مختصر)
  ctx.textAlign = 'center';
  const step = Math.max(1, Math.ceil(data.length / 6));
  data.forEach((p, i) => {
    if (i % step !== 0 && i !== data.length - 1) { return; }
    const d = new Date(p.ts || Date.now());
    const label = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    ctx.fillText(label, xFor(i), cssH - 6);
  });
}

/** أعمدة تكرار الظهور حسب نطاق الترتيب (1-10, 11-20, …) */
export function drawBuckets(canvas, results) {
  if (!canvas || !canvas.getContext) { return; }
  const ctx = canvas.getContext('2d');
  const cssW = canvas.clientWidth || 300;
  const cssH = canvas.clientHeight || 90;
  ctx.clearRect(0, 0, cssW, cssH);
  const buckets = [0, 0, 0, 0, 0];
  for (const r of results || []) {
    if (!r.found || typeof r.position !== 'number') { continue; }
    const idx = Math.min(4, Math.floor((r.position - 1) / 10));
    buckets[idx] += 1;
  }
  const max = Math.max(1, ...buckets);
  const bw = cssW / buckets.length;
  const labels = ['1-10', '11-20', '21-30', '31-40', '41+'];
  buckets.forEach((count, i) => {
    const bh = (count / max) * (cssH - 24);
    ctx.fillStyle = count ? 'rgba(34,197,94,.75)' : 'rgba(143,161,189,.2)';
    ctx.fillRect(i * bw + 6, cssH - 16 - bh, bw - 12, bh);
    ctx.fillStyle = 'rgba(230,237,247,.85)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(labels[i], i * bw + bw / 2, cssH - 4);
  });
}
