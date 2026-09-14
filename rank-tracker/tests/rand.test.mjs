import test from 'node:test';
import assert from 'node:assert/strict';
import { jitter, humanDelay, gaussian, randInt, pick } from '../src/background/core/rand.js';

test('jitter: ضمن الحدود', () => {
  for (let i = 0; i < 500; i++) {
    const v = jitter(4000, 1500);
    assert.ok(v >= 2500 && v <= 5500, `out of bounds: ${v}`);
  }
});

test('jitter: صفر jitter = قيمة ثابتة', () => {
  assert.equal(jitter(4000, 0), 4000);
});

test('humanDelay: لا ينتج قيماً سالبة', () => {
  for (let i = 0; i < 300; i++) {
    assert.ok(humanDelay(500, 400) >= 0);
  }
});

test('gaussian: متوسط تقريبي حول الأساس', () => {
  const samples = Array.from({ length: 2000 }, () => gaussian(1000, 100));
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  assert.ok(Math.abs(mean - 1000) < 60, `mean=${mean}`);
});

test('randInt و pick: سلوك سليم', () => {
  for (let i = 0; i < 200; i++) {
    const v = randInt(3, 5);
    assert.ok(v >= 3 && v <= 5);
  }
  assert.equal(pick([]), null);
  assert.ok([1, 2, 3].includes(pick([1, 2, 3])));
});
