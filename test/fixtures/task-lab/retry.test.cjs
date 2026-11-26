const test = require('node:test');
const assert = require('node:assert/strict');
const retry = require('./retry.cjs');

test('successful call is not repeated', () => {
  let calls = 0;
  assert.equal(retry(() => { calls++; return 42; }), 42);
  assert.equal(calls, 1);
});

test('one retry after an exception', () => {
  let calls = 0;
  assert.equal(retry(() => { if (++calls === 1) throw Error('transient'); return 42; }), 42);
  assert.equal(calls, 2);
});

test('second exception propagates without third attempt', () => {
  let calls = 0;
  const last = new Error('second');
  assert.throws(() => retry(() => { if (++calls === 1) throw Error('first'); throw last; }), error => error === last);
  assert.equal(calls, 2);
});
