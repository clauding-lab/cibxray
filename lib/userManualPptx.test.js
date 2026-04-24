import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MANUAL_SLIDES } from '../src/export/userManualPptx.js';

test('MANUAL_SLIDES: has at least 15 slides', () => {
  assert.ok(MANUAL_SLIDES.length >= 15, `Expected 15+ slides, got ${MANUAL_SLIDES.length}`);
});

test('MANUAL_SLIDES: first slide is the title slide', () => {
  assert.equal(MANUAL_SLIDES[0].kind, 'title');
  assert.equal(MANUAL_SLIDES[0].title, 'CIBxRay');
  assert.ok(MANUAL_SLIDES[0].subtitle);
});

test('MANUAL_SLIDES: second slide is the table of contents', () => {
  assert.equal(MANUAL_SLIDES[1].kind, 'toc');
  assert.ok(Array.isArray(MANUAL_SLIDES[1].toc));
  assert.equal(MANUAL_SLIDES[1].toc.length, 3);
});

test('MANUAL_SLIDES: three section dividers', () => {
  const dividers = MANUAL_SLIDES.filter(s => s.kind === 'divider');
  assert.equal(dividers.length, 3);
  assert.deepEqual(dividers.map(d => d.section), [1, 2, 3]);
  for (const d of dividers) {
    assert.ok(d.sectionTitle);
    assert.ok(d.sectionNo);
  }
});

test('MANUAL_SLIDES: closing slide is last', () => {
  assert.equal(MANUAL_SLIDES[MANUAL_SLIDES.length - 1].kind, 'closing');
});

test('MANUAL_SLIDES: every content slide has title + body + section', () => {
  for (const [i, slide] of MANUAL_SLIDES.entries()) {
    if (slide.kind !== 'content') continue;
    assert.ok(slide.title, `slide ${i} missing title`);
    assert.ok(slide.body, `slide ${i} missing body`);
    assert.ok(Array.isArray(slide.body) || typeof slide.body === 'string',
      `slide ${i} body must be string or string[]`);
    assert.ok([1, 2, 3].includes(slide.section),
      `slide ${i} "${slide.title}" missing valid section (1/2/3)`);
  }
});

test('MANUAL_SLIDES: content covers the required topic set', () => {
  const contentTitles = MANUAL_SLIDES
    .filter(s => s.kind === 'content')
    .map(s => s.title.toLowerCase());
  const tabTopics = ['summary', 'borrower', 'exposure', 'behavioral', 'credit cards', 'red flags', 'linked entities', 'export'];
  for (const topic of tabTopics) {
    assert.ok(
      contentTitles.some(t => t.includes(topic)),
      `No content slide covers "${topic}"`,
    );
  }
  for (const topic of ['group detection', 'kyc', 'error banner', 'print', 'scoring', 'privacy']) {
    assert.ok(
      contentTitles.some(t => t.includes(topic)),
      `No content slide covers "${topic}"`,
    );
  }
});

test('MANUAL_SLIDES: readability cap — no content slide over 10 bullets', () => {
  for (const [i, slide] of MANUAL_SLIDES.entries()) {
    if (slide.kind !== 'content' || !Array.isArray(slide.body)) continue;
    assert.ok(slide.body.length <= 10,
      `slide ${i} "${slide.title}" has ${slide.body.length} bullets — trim for readability`);
  }
});

test('MANUAL_SLIDES: tab-tour slides reference real screenshots', () => {
  const tabTourSlides = MANUAL_SLIDES.filter(s =>
    s.kind === 'content' && s.title.startsWith('Tab tour'));
  assert.ok(tabTourSlides.length >= 5, `Expected at least 5 tab-tour slides, got ${tabTourSlides.length}`);
  for (const s of tabTourSlides) {
    assert.ok(s.screenshot, `Tab tour "${s.title}" missing screenshot path`);
    assert.ok(s.screenshot.startsWith('/manual-screenshots/'),
      `Tab tour "${s.title}" screenshot path must be /manual-screenshots/*.png`);
    assert.ok(s.screenshot.endsWith('.png'),
      `Tab tour "${s.title}" screenshot must be a .png`);
  }
});

test('MANUAL_SLIDES: callout boxes only on Rules-section slides', () => {
  for (const slide of MANUAL_SLIDES) {
    if (!slide.callout) continue;
    assert.equal(slide.section, 2, `Callout box on non-Rules slide "${slide.title}"`);
    assert.ok(slide.callout.label, `Callout on "${slide.title}" missing label`);
    assert.ok(slide.callout.text, `Callout on "${slide.title}" missing text`);
  }
});

test('MANUAL_SLIDES: classification legend slide is in the Reference section', () => {
  const legendSlides = MANUAL_SLIDES.filter(s => s.showsClassificationLegend);
  assert.equal(legendSlides.length, 1, 'Exactly one slide should host the classification legend');
  assert.equal(legendSlides[0].section, 3);
  assert.ok(legendSlides[0].title.toLowerCase().includes('red flag'));
});
