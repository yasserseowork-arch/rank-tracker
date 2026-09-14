/**
 * logger.js — سجل حيّ متعدد المستويات مع بث للوحة الجانبية
 */
import { C } from './bridge.js';
import * as state from './state.js';

const LEVELS = ['debug', 'info', 'warn', 'error'];

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

export async function log(level, scope, text, data) {
  const entry = {
    ts: Date.now(),
    time: stamp(),
    level: LEVELS.includes(level) ? level : 'info',
    scope: scope || 'core',
    text: String(text == null ? '' : text),
    data: data === undefined ? null : data
  };
  await state.pushLog(entry);
  // بث للوحة الجانبية إن كانت مفتوحة
  try {
    chrome.runtime.sendMessage(Object.assign({ type: C.MSG.LOG }, entry), () => { void chrome.runtime.lastError; });
  } catch (_) {}
  const line = `[SRT][${entry.time}][${entry.level}][${entry.scope}] ${entry.text}`;
  if (entry.level === 'error') { console.error(line); }
  else if (entry.level === 'warn') { console.warn(line); }
  else { console.info(line); }
  return entry;
}

export const debug = (scope, text, data) => log('debug', scope, text, data);
export const info = (scope, text, data) => log('info', scope, text, data);
export const warn = (scope, text, data) => log('warn', scope, text, data);
export const error = (scope, text, data) => log('error', scope, text, data);
