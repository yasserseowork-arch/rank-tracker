/**
 * تحميل سكربت كلاسيكي (يُحقن عادة في المتصفح) داخل بيئة Node للاختبار.
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

export function loadClassic(relativePath) {
  const file = path.resolve(process.cwd(), relativePath);
  const code = fs.readFileSync(file, 'utf8');
  const sandbox = { console, setTimeout, clearTimeout, setInterval, clearInterval, URL, URLSearchParams, TextEncoder, TextDecoder };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(code, context, { filename: file });
  return sandbox;
}
