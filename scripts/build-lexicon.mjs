/**
 * build-lexicon.mjs
 * ------------------------------------------------------------------
 * Generates `public/lexicon.json` from `words.json`.
 *
 * The app and the RAG retriever read the generated lexicon at runtime,
 * so this must be re-run whenever the dictionary source changes:
 *
 *   npm run build:lexicon            # regenerate
 *   npm run build:lexicon -- --report  # inspect parsing quality
 *
 * `words.json` is intentionally git-ignored (it is a scraped source
 * dump), while `public/lexicon.json` IS committed so a fresh clone
 * works without the source file.
 * ------------------------------------------------------------------
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLexicon } from './lib/lexicon-parse.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(projectRoot, 'words.json');
const OUT = path.join(projectRoot, 'public', 'lexicon.json');
const REPORT = process.argv.includes('--report');

function fail(message) {
  console.error(`\n  ! ${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(SOURCE)) {
  // A missing source must never break `npm run build` on a fresh clone.
  console.warn(`\n  ! words.json not found at ${SOURCE}`);
  if (fs.existsSync(OUT)) {
    console.warn('    Keeping the existing public/lexicon.json as-is.\n');
    process.exit(0);
  }
  fail('No lexicon source and no generated lexicon — nothing to build.');
}

const rows = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
if (!Array.isArray(rows)) fail('words.json must contain an array of rows.');

const lexicon = buildLexicon(rows);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(lexicon)}\n`, 'utf8');

const bytes = fs.statSync(OUT).size;
console.log(`\n  lexicon.json written`);
console.log(`    entries : ${lexicon.stats.entries}`);
console.log(`    terms   : ${lexicon.stats.terms}`);
console.log(`    examples: ${lexicon.stats.examples}`);
console.log(`    size    : ${(bytes / 1024).toFixed(1)} KB`);
console.log(`    path    : ${path.relative(projectRoot, OUT)}\n`);

if (REPORT) {
  const flagged = lexicon.entries.filter((e) => e.flags.length);
  console.log(`  Entries needing human review: ${flagged.length}/${lexicon.entries.length}`);
  for (const e of flagged) {
    console.log(`    - ${e.en}  [${e.flags.join(', ')}]`);
  }

  console.log('\n  Sample parses:');
  for (const e of lexicon.entries.slice(0, 8)) {
    const terms = e.terms.map((t) => t.hz + (t.classPrefix ? ` (${t.classPrefix}-)` : '')).join(', ');
    console.log(`    ${e.en} -> ${terms || '(none)'}`);
    for (const x of e.examples) console.log(`        ex: ${x.en ?? '(cue)'} = ${x.hz}`);
  }
  console.log('');
}
