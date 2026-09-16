/**
 * syntax-check.mjs — فحص صيغة كل ملفات JS بالمشروع
 * - ملفات classic تُفحص كما هي
 * - ملفات ES modules تُنسخ مؤقتاً بامتداد .mjs قبل الفحص
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(process.cwd());
// المسح آلي على src/ كلها — القوائم اليدوية كانت بتفلت ملفات زي i18n-ui.js (علة 1.18.8)
const ROOT_WALKS = ['src'];
const MODULE_PREFIXES = ['src/background', 'src/sidepanel'];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full, out); }
    else if (entry.name.endsWith('.js')) { out.push(full); }
  }
  return out;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'srt-check-'));
let failed = 0;

function check(file, asModule) {
  let target = file;
  if (asModule) {
    target = path.join(tmp, path.basename(file).replace(/\.js$/, '.mjs'));
    fs.copyFileSync(file, target);
  }
  try {
    execFileSync(process.execPath, ['--check', target], { stdio: 'pipe' });
    console.log('  OK  ', path.relative(ROOT, file));
  } catch (err) {
    failed++;
    console.error(' FAIL ', path.relative(ROOT, file));
    console.error(String(err.stderr || err.message));
  }
}

console.log('== كل ملفات src/ — modules وclassic بالمسح الآلي ==');
const seen = new Set();
for (const dir of ROOT_WALKS) {
  for (const file of walk(path.join(ROOT, dir))) {
    if (seen.has(file)) { continue; }
    seen.add(file);
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    const isModule = MODULE_PREFIXES.some((pre) => rel.indexOf(pre) === 0);
    check(file, isModule);
  }
}
if (!seen.size) { console.error('المسح لقاش أي ملفات!'); failed++; }

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `\n${failed} file(s) FAILED` : '\nAll files passed syntax check');
process.exit(failed ? 1 : 0);
