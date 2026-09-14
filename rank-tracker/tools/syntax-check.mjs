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
const MODULE_DIRS = ['src/background', 'src/sidepanel'];
const CLASSIC_FILES = [
  'src/lib/constants.js',
  'src/lib/messaging.js',
  'src/lib/dom.js',
  'src/lib/url.js',
  'src/lib/csv.js',
  'src/content/serp.js',
  'src/content/captcha.js',
  'src/content/consent.js',
  'src/options/options.js'
];

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

console.log('== classic scripts ==');
for (const rel of CLASSIC_FILES) { check(path.join(ROOT, rel), false); }

console.log('== ES modules ==');
for (const dir of MODULE_DIRS) {
  for (const file of walk(path.join(ROOT, dir))) { check(file, true); }
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `\n${failed} file(s) FAILED` : '\nAll files passed syntax check');
process.exit(failed ? 1 : 0);
