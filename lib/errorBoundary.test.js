import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveErrorState } from '../src/components/ErrorBoundary.js';

test('deriveErrorState returns hasError: true with the error reference', () => {
  const err = new Error('boom');
  const next = deriveErrorState(err);
  assert.equal(next.hasError, true);
  assert.equal(next.error, err);
});

test('deriveErrorState is pure — called twice with the same input returns equal output', () => {
  const err = new Error('boom');
  const a = deriveErrorState(err);
  const b = deriveErrorState(err);
  assert.deepEqual(a, b);
});
