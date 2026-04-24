import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MANUAL_SLIDES } from '../src/export/userManualPptx.js';

test('MANUAL_SLIDES: has at least 10 slides', () => {
  assert.ok(MANUAL_SLIDES.length >= 10, `Expected 10+ slides, got ${MANUAL_SLIDES.length}`);
});

test('MANUAL_SLIDES: first slide is the title slide', () => {
  assert.equal(MANUAL_SLIDES[0].kind, 'title');
  assert.equal(MANUAL_SLIDES[0].title, 'CIBxRay');
  assert.ok(MANUAL_SLIDES[0].subtitle);
});

test('MANUAL_SLIDES: every non-title slide has title + body', () => {
  for (const [i, slide] of MANUAL_SLIDES.entries()) {
    if (slide.kind === 'title') continue;
    assert.ok(slide.title, `slide ${i} missing title`);
    assert.ok(slide.body, `slide ${i} missing body`);
    assert.ok(Array.isArray(slide.body) || typeof slide.body === 'string',
      `slide ${i} body must be string or string[]`);
  }
});

test('MANUAL_SLIDES: covers the required topic set', () => {
  const titles = MANUAL_SLIDES.map(s => s.title.toLowerCase());
  // Tab tour coverage — checks the union includes all 8 major tabs
  const tabTopics = ['summary', 'borrower', 'exposure', 'behavioral', 'credit cards', 'red flags', 'linked entities', 'export'];
  for (const topic of tabTopics) {
    assert.ok(
      titles.some(t => t.includes(topic)),
      `No slide covers "${topic}"`,
    );
  }
  // Core rule topics
  for (const topic of ['group detection', 'kyc', 'error banner', 'print', 'scoring', 'privacy']) {
    assert.ok(
      titles.some(t => t.includes(topic)),
      `No slide covers "${topic}"`,
    );
  }
});

test('MANUAL_SLIDES: no slide has more than 10 bullets (readability cap)', () => {
  for (const [i, slide] of MANUAL_SLIDES.entries()) {
    if (!Array.isArray(slide.body)) continue;
    assert.ok(slide.body.length <= 10,
      `slide ${i} "${slide.title}" has ${slide.body.length} bullets — trim for readability`);
  }
});
