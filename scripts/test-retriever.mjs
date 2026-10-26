/**
 * test-retriever.mjs
 * ------------------------------------------------------------------
 * Retrieval quality harness for the RAG pipeline.
 *
 * Bundles the TypeScript retriever with esbuild, runs a set of English
 * (and Otjiherero) probes against the real lexicon, and checks that the
 * expected headwords land in the top-k that would be sent to the model.
 *
 *   npm run test:rag
 *
 * No API key or network access required.
 * ------------------------------------------------------------------
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const outfile = path.join(os.tmpdir(), `herero-rag-test-${Date.now()}.mjs`);
await build({
  entryPoints: [path.join(projectRoot, 'src/lib/rag/retriever.ts')],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  outfile,
  logLevel: 'silent',
});

const { retrieve, lookupWord } = await import(pathToFileURL(outfile).href);
const lexicon = JSON.parse(fs.readFileSync(path.join(projectRoot, 'public', 'lexicon.json'), 'utf8'));

/** Each case: the sentence, and headwords that MUST appear in the context. */
const CASES = [
  { en: 'The woman is pregnant.', expect: ['WOMAN'] },
  { en: 'He works in a marvellous way.', expect: ['WAY'] },
  { en: 'The child is wet.', expect: ['WET'] },
  { en: 'Where do you stay?', expect: ['WHERE?'] },
  { en: 'The people were wiped out.', expect: ['WIPE'] },
  { en: 'I whistle a tune.', expect: ['WHISTLING', 'WHISTLE'] },
  { en: 'The screw is worn out.', expect: ['WORN OFF'] },
  { en: 'Dig a well in the garden.', expect: ['WELL', 'WEED'] },
  { en: 'A widow and her children.', expect: ['WIDOW'] },
  { en: 'Wring out the dish-cloth.', expect: ['WRING OUT'] },
  { en: 'The wind is strong, a storm is coming.', expect: ['WIND'] },
  { en: 'Write a letter to the worker.', expect: ['WRITE', 'WORKER'] },
];

const REVERSE_CASES = [
  { hz: 'omukazendu', expect: ['WOMAN'] },
  { hz: 'otjivike', expect: ['WEEK'] },
  { hz: 'Ovandu avehe va pondoka', expect: ['WIPE'] },
  { hz: 'ombepo', expect: ['WIND'] },
];

let failures = 0;
const K = 10;

console.log('\n  EN -> HZ retrieval (top-%d context blocks)\n', K);
for (const testCase of CASES) {
  const result = retrieve(lexicon, testCase.en, 'en-hz', K);
  const got = result.blocks.map((b) => b.en);
  const ok = testCase.expect.some((e) => got.includes(e));
  if (!ok) failures++;
  const rank = Math.min(...testCase.expect.map((e) => (got.includes(e) ? got.indexOf(e) + 1 : 99)));
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  "${testCase.en}"`);
  console.log(`        expect ${testCase.expect.join(' | ')}  -> rank ${rank === 99 ? '-' : rank}`);
  console.log(`        got    ${got.slice(0, 6).join(', ')}`);
  if (result.uncovered.length) console.log(`        gaps   ${result.uncovered.join(', ')}`);
}

console.log('\n  HZ -> EN retrieval\n');
for (const testCase of REVERSE_CASES) {
  const result = retrieve(lexicon, testCase.hz, 'hz-en', K);
  const got = result.blocks.map((b) => b.en);
  const ok = testCase.expect.some((e) => got.includes(e));
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  "${testCase.hz}" -> ${got.slice(0, 5).join(', ')}`);
}

console.log('\n  Word lookup (offline dictionary mode)\n');
for (const [word, dir] of [
  ['woman', 'en-hz'],
  ['working', 'en-hz'],
  ['strong', 'en-hz'],
  ['otjivike', 'hz-en'],
  ['ombepo', 'hz-en'],
]) {
  const res = lookupWord(lexicon, word, dir);
  console.log(`  ${word} (${dir}): ${res.hits.slice(0, 3).map((h) => `${h.en}=${h.hz}[${h.matchType}]`).join('  ') || 'no hits'}`);
}

fs.unlinkSync(outfile);

console.log(`\n  ${failures === 0 ? 'All retrieval checks passed.' : `${failures} retrieval check(s) failed.`}\n`);
process.exit(failures === 0 ? 0 : 1);
