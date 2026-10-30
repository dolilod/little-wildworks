// Acceptance 12 — Screenshots saved to test-artifacts/ for human review: title, mobile play,
// desktop play, each befriend moment, each completed project, the picnic, the final card,
// roster, memory book and the My Friend editor. Earlier tests capture the story moments;
// this test checks they all exist and are real images, and writes a contact list.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ARTIFACTS } from './lib/browser.mjs';

const REQUIRED = [
  'title', 'mobile-play', 'desktop-play',
  'befriend-tumbletuft', 'befriend-whirli', 'befriend-puddleloop', 'befriend-glintot',
  'befriend-foldfern', 'befriend-kitefin', 'befriend-siltbell', 'befriend-hushbulb',
  'project-leaf_slide', 'project-lotus_steps', 'project-pinwheel_canopy', 'project-lantern_picnic',
  'picnic', 'final-card', 'roster', 'memory-book', 'editor',
];

test('12. Screenshots: every required moment was captured as a real PNG in test-artifacts/', () => {
  const rows = [];
  for (const name of REQUIRED) {
    const f = path.join(ARTIFACTS, name + '.png');
    assert.ok(existsSync(f), `missing screenshot ${name}.png (run the full suite with npm test)`);
    const size = statSync(f).size;
    assert.ok(size > 15000, `${name}.png looks empty (${size} bytes)`);
    rows.push(`${name}.png  ${size} bytes`);
  }
  writeFileSync(path.join(ARTIFACTS, 'SCREENSHOTS.txt'), rows.join('\n') + '\n');
});
