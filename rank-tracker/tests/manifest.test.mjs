import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadClassic } from './helpers/load-classic.mjs';

const manifest = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'manifest.json'), 'utf8'));

test('manifest: أنماط البحث تغطي google.com بدون www (علة تشغيل حقيقية)', () => {
  const search = manifest.content_scripts[0].matches;
  assert.ok(search.includes('https://google.com/search*'), 'missing non-www google.com');
  assert.ok(search.includes('https://www.google.com/search*'), 'missing www google.com');
  assert.ok(search.includes('https://google.sa/search*'), 'missing non-www google.sa');
});

test('manifest: أنماط الكابتشا تغطي sorry وrecaptcha بالحالتين', () => {
  const cap = manifest.content_scripts[1].matches;
  assert.ok(cap.includes('https://google.com/sorry/*'));
  assert.ok(cap.includes('*://google.com/recaptcha/*'));
  assert.ok(cap.some((m) => m.includes('recaptcha.net')));
});

test('constants: معرف Buster الحقيقي في صدارة محددات الزر', () => {
  const sandbox = loadClassic('src/lib/constants.js');
  const buster = sandbox.SRT_C.SEL.buster;
  assert.ok(buster[0].includes('mpbjkejclgfgadiemmefgebjfooflfhl'), 'buster id selector must be first');
  assert.ok(buster[1].startsWith('img[src^="chrome-extension://"]'));
});

test('manifest: سكربتات SERP تتضمن matchlib وerrorsig قبل serp.js', () => {
  const js = manifest.content_scripts[0].js;
  assert.ok(js.indexOf('src/lib/matchlib.js') !== -1);
  assert.ok(js.indexOf('src/lib/errorsig.js') !== -1);
  assert.ok(js[js.length - 1] === 'src/content/serp.js');
});

test('manifest: سكربتات الكابتشا تشمل url.js قبل captcha.js (علة TypeError التاريخية)', () => {
  const js = manifest.content_scripts[1].js;
  assert.ok(js.includes('src/lib/url.js'), 'url.js missing from captcha content scripts');
  assert.ok(js.indexOf('src/lib/url.js') < js.indexOf('src/content/captcha.js'));
});

test('manifest: سكربتات الكابتشا تُحقن عند document_end (استجابة تحت الثانية)', () => {
  assert.equal(manifest.content_scripts[1].run_at, 'document_end');
});
