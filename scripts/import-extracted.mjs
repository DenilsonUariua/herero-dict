/**
 * import-extracted.mjs
 * ------------------------------------------------------------------
 * Imports dictionary material extracted from the two PDFs into
 *
 *   1. the Appwrite `words` table (what the site reads)
 *   2. words.json                (what the RAG lexicon is built from)
 *
 * Sources (produced by the extraction step, kept out of git):
 *   .extract/phrases.json          curated common phrases (clean text layer)
 *   .extract/dict-p<page>.jsonl    transcribed dictionary pages, one entry/line
 *
 * Idempotent: rows whose headword already exists (case-insensitive) are skipped,
 * so it is safe to re-run after adding more pages.
 *
 *   node scripts/import-extracted.mjs --dry-run
 *   node scripts/import-extracted.mjs
 * ------------------------------------------------------------------
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, TablesDB, Query } from 'node-appwrite';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXTRACT = path.join(projectRoot, '.extract');
const DRY_RUN = process.argv.includes('--dry-run');

// ---------------------------------------------------------------- env
const envRaw = fs.readFileSync(path.join(projectRoot, '.env'), 'utf8');
const env = Object.fromEntries(
  envRaw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')];
    }),
);

const DATABASE_ID = env.VITE_APPWRITE_DATABASE_ID;
const TABLE_ID = env.VITE_APPWRITE_COLLECTION_ID || 'words';

if (!env.VITE_APPWRITE_ENDPOINT || !env.VITE_APPWRITE_PROJECT_ID || !DATABASE_ID || !env.APPWRITE_API_KEY) {
  console.error('Missing Appwrite credentials in .env');
  process.exit(1);
}

const tables = new TablesDB(
  new Client()
    .setEndpoint(env.VITE_APPWRITE_ENDPOINT)
    .setProject(env.VITE_APPWRITE_PROJECT_ID)
    .setKey(env.APPWRITE_API_KEY),
);

// ---------------------------------------------------------------- sources
function readPhrases() {
  const file = path.join(EXTRACT, 'phrases.json');
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8')).map((row) => ({ ...row, origin: 'common-phrases' }));
}

function readDictionaryPages() {
  if (!fs.existsSync(EXTRACT)) return [];
  const files = fs
    .readdirSync(EXTRACT)
    .filter((f) => /^dict-p\d+\.jsonl$/.test(f))
    .sort();

  const rows = [];
  for (const file of files) {
    const lines = fs.readFileSync(path.join(EXTRACT, file), 'utf8').split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        rows.push({ ...JSON.parse(line), origin: 'viljoen-1983' });
      } catch {
        console.warn(`  ! skipped malformed line in ${file}`);
      }
    }
  }
  return rows;
}

// ---------------------------------------------------------------- normalise
const now = new Date().toISOString();

function toRow(source) {
  const word = String(source.word ?? '').trim().toUpperCase();
  if (!word) return null;

  const definitions = Array.isArray(source.definitions)
    ? source.definitions.map((d) => String(d).trim()).filter(Boolean)
    : source.definitions
      ? [String(source.definitions).trim()]
      : [];

  const tags = new Set(source.tags ?? []);
  if (source.origin === 'viljoen-1983') {
    tags.add('scan-import');
    tags.add('viljoen-1983');
    if (source.sourcePage) tags.add(`p${source.sourcePage}`);
    if (source.review) tags.add('needs-review');
  }

  const row = {
    languageId: 'en',
    word,
    status: 'approved',
    likes: 0,
    dateAdded: now,
    lastModified: now,
  };

  if (source.pronunciation) row.pronunciation = String(source.pronunciation).trim();
  if (definitions.length) row.definitions = definitions;
  if (source.partOfSpeech) row.partOfSpeech = source.partOfSpeech;
  if (tags.size) row.tags = [...tags];

  return row;
}

// ---------------------------------------------------------------- run
console.log(`\nImporting extracted dictionary material${DRY_RUN ? ' (dry run)' : ''}\n`);

const sources = [...readPhrases(), ...readDictionaryPages()];
console.log(`  parsed      ${sources.length} rows (${readPhrases().length} phrases, ${readDictionaryPages().length} dictionary)`);

const normalised = sources.map(toRow).filter(Boolean);

// de-duplicate within the batch, merging senses rather than dropping them
function mergePronunciations(a, b) {
  const clean = (s) =>
    String(s ?? '')
      .trim()
      .replace(/^[\s/]+/, '')
      .replace(/[\s.]+$/, '');
  const parts = [clean(a), clean(b)].filter(Boolean);
  const seen = new Set();
  const merged = [];
  for (const part of parts.join(', ').split(',')) {
    const key = part.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(part.trim());
  }
  return merged.length ? `/${merged.join(', ')}.` : '';
}

const byWord = new Map();
for (const row of normalised) {
  const key = row.word.toUpperCase();
  if (!byWord.has(key)) {
    byWord.set(key, row);
    continue;
  }
  const existing = byWord.get(key);
  const mergedDefs = new Set([...(existing.definitions ?? []), ...(row.definitions ?? [])]);
  if (mergedDefs.size) existing.definitions = [...mergedDefs];
  if (row.pronunciation) {
    existing.pronunciation = existing.pronunciation
      ? mergePronunciations(existing.pronunciation, row.pronunciation)
      : row.pronunciation;
  }
  const tags = new Set([...(existing.tags ?? []), ...(row.tags ?? [])]);
  if (tags.size) existing.tags = [...tags];
}
const candidates = [...byWord.values()];
console.log(`  unique      ${candidates.length} after de-duplicating headwords`);

// fetch what is already live
const existing = new Set();
let offset = 0;
for (;;) {
  const res = await tables.listRows(DATABASE_ID, TABLE_ID, [Query.limit(100), Query.offset(offset)]);
  res.rows.forEach((r) => existing.add(String(r.word ?? '').toUpperCase()));
  if (res.rows.length < 100) break;
  offset += 100;
}
console.log(`  already in database  ${existing.size}`);

const fresh = candidates.filter((row) => !existing.has(row.word.toUpperCase()));
console.log(`  new         ${fresh.length}\n`);

if (!fresh.length) {
  console.log('Nothing to import.\n');
  process.exit(0);
}

const needsReview = fresh.filter((row) => (row.tags ?? []).includes('needs-review'));
if (needsReview.length) {
  console.log(`  flagged for review: ${needsReview.length}`);
  for (const row of needsReview) console.log(`    - ${row.word}`);
  console.log('');
}

if (DRY_RUN) {
  console.log('Dry run — sample rows:');
  for (const row of fresh.slice(0, 5)) console.log(' ', JSON.stringify(row));
  console.log('');
  process.exit(0);
}

// push to Appwrite in chunks
let created = 0;
for (let i = 0; i < fresh.length; i += 100) {
  const chunk = fresh.slice(i, i + 100);
  await tables.createRows(DATABASE_ID, TABLE_ID, chunk.map((row) => ({ ...row })));
  created += chunk.length;
  process.stdout.write(`\r  uploaded    ${created}/${fresh.length}`);
}
console.log('\n');

// keep words.json in sync so `npm run build:lexicon` sees the new entries
const wordsPath = path.join(projectRoot, 'words.json');
const words = fs.existsSync(wordsPath) ? JSON.parse(fs.readFileSync(wordsPath, 'utf8')) : [];
const known = new Set(words.map((w) => String(w.word ?? '').toUpperCase()));
let appended = 0;
for (const row of fresh) {
  if (known.has(row.word.toUpperCase())) continue;
  known.add(row.word.toUpperCase());
  words.push({
    word: row.word,
    pronunciation: row.pronunciation ?? '',
    // keep the array intact: the lexicon parser reads multiple example pairs
    // from it, and joining them would collapse the variants into one string
    definitions: row.definitions ?? [],
    partOfSpeech: row.partOfSpeech,
    tags: row.tags,
    dateAdded: now.slice(0, 10),
    lastModified: now.slice(0, 10),
    likes: 0,
  });
  appended += 1;
}
fs.writeFileSync(wordsPath, `${JSON.stringify(words, null, 4)}\n`, 'utf8');

console.log(`  created     ${created} rows in "${TABLE_ID}"`);
console.log(`  words.json  ${appended} appended (now ${words.length} total)`);
console.log('\nNext: npm run build:lexicon  (refresh the RAG lexicon)\n');
