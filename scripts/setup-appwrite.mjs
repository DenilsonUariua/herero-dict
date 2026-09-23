/**
 * setup-appwrite.mjs
 * ------------------------------------------------------------------
 * Sets up the full Appwrite TablesDB schema for the Herero Dictionary.
 *
 * Idempotent: safe to run repeatedly. Existing tables/columns/indexes
 * are detected and skipped; data import only runs when tables are empty.
 *
 * Multi-language design:
 *  - `languages`    registry of languages (add more anytime, no schema change)
 *  - `words`        lexical entries, each row belongs to ONE language (languageId)
 *  - `translations` maps any word entry to its translation in any other language
 *
 * Usage:
 *   node scripts/setup-appwrite.mjs           # schema + seed + import
 *   node scripts/setup-appwrite.mjs --schema  # schema only, no data
 * ------------------------------------------------------------------
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, TablesDB, Permission, Role, ID, AppwriteException, Query } from 'node-appwrite';

// ---------------------------------------------------------------- env
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envRaw = fs.readFileSync(path.join(projectRoot, '.env'), 'utf8');
const env = Object.fromEntries(
  envRaw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')];
    })
);

const ENDPOINT = env.VITE_APPWRITE_ENDPOINT;
const PROJECT_ID = env.VITE_APPWRITE_PROJECT_ID;
const DATABASE_ID = env.VITE_APPWRITE_DATABASE_ID;
// Non-VITE server key (never bundled into the client). Falls back to the legacy name.
const API_KEY = env.APPWRITE_API_KEY || env.VITE_APPWRITE_DATABASE_API_KEY;

if (!ENDPOINT || !PROJECT_ID || !DATABASE_ID || !API_KEY) {
  console.error('Missing Appwrite configuration in .env (endpoint, project, database, API key).');
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
const tables = new TablesDB(client);

const ONLY_SCHEMA = process.argv.includes('--schema');
const DATA_ONLY = process.argv.includes('--data');

// ---------------------------------------------------------------- helpers
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Appwrite Cloud metadata can be briefly inconsistent — retry transient 404/5xx. */
async function retry(fn, { attempts = 5, delayMs = 1500, retryOn = [404, 500, 502, 503, 504] } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (!retryOn.includes(e.code)) throw e;
      if (i < attempts - 1) await sleep(delayMs);
    }
  }
  throw lastErr;
}

async function waitForColumn(tableId, key, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const col = await tables.getColumn(DATABASE_ID, tableId, key);
      if (col.status === 'available') return col;
      if (col.status === 'failed' || col.status === 'missing') throw new Error(`Column ${key} status: ${col.status}`);
    } catch (e) {
      if (e.code === 404) { /* not registered yet */ }
      else throw e;
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for column ${tableId}.${key}`);
}

async function ensureTable(def) {
  let table;
  try {
    table = await retry(() => tables.getTable(DATABASE_ID, def.id), { attempts: 2, delayMs: 1000 });
    console.log(`  = table exists: ${def.id}`);
  } catch (e) {
    if (e.code !== 404) throw e;
    try {
      table = await tables.createTable(DATABASE_ID, def.id, def.name, def.permissions ?? [], def.rowSecurity ?? false);
      console.log(`  + created table: ${def.id}`);
    } catch (e2) {
      if (e2.code !== 409) throw e2; // already exists (race/stale cache)
      table = await tables.get(DATABASE_ID, def.id);
      console.log(`  = table exists (race): ${def.id}`);
    }
    await sleep(2000); // let metadata settle before column operations
  }
  return table;
}

async function ensureColumns(def) {
  const existing = new Map();
  let page = 0;
  for (;;) {
    const res = await retry(() => tables.listColumns(DATABASE_ID, def.id, [Query.limit(100), Query.offset(page * 100)]));
    res.columns.forEach((c) => existing.set(c.key, c));
    if (res.columns.length < 100) break;
    page++;
  }

  for (const col of def.columns) {
    if (existing.has(col.key)) { console.log(`    = column ${col.key}`); continue; }
    const args = [DATABASE_ID, def.id, col.key];
    switch (col.type) {
      case 'string':
        await tables.createStringColumn(...args, col.size, col.required, col.default ?? undefined, col.array ?? false);
        break;
      case 'enum':
        await tables.createEnumColumn(...args, col.elements, col.required, col.default ?? undefined, col.array ?? false);
        break;
      case 'datetime':
        await tables.createDatetimeColumn(...args, col.required, col.default ?? undefined, col.array ?? false);
        break;
      case 'boolean':
        await tables.createBooleanColumn(...args, col.required, col.default ?? undefined, col.array ?? false);
        break;
      case 'integer':
        await tables.createIntegerColumn(...args, col.required, col.min ?? undefined, col.max ?? undefined, col.default ?? undefined, col.array ?? false);
        break;
      default:
        throw new Error(`Unknown column type ${col.type} for ${def.id}.${col.key}`);
    }
    console.log(`    + column ${col.key}`);
  }

  // Wait until every column in this table is available (required before indexing).
  for (const col of def.columns) {
    await retry(() => waitForColumn(def.id, col.key));
  }
}

async function ensureIndexes(def) {
  if (!def.indexes?.length) return;
  const existing = new Set();
  let page = 0;
  for (;;) {
    const res = await retry(() => tables.listIndexes(DATABASE_ID, def.id, [Query.limit(100), Query.offset(page * 100)]));
    res.indexes.forEach((i) => existing.add(i.key));
    if (res.indexes.length < 100) break;
    page++;
  }
  for (const idx of def.indexes) {
    if (existing.has(idx.key)) { console.log(`    = index ${idx.key}`); continue; }
    try {
      await tables.createIndex(DATABASE_ID, def.id, idx.key, idx.type, idx.columns, idx.orders ?? undefined);
      console.log(`    + index ${idx.key} (${idx.type})`);
    } catch (e) {
      // A failed optional index (e.g. fulltext on an array column) must not abort the setup.
      if (idx.optional) console.log(`    ! skipped index ${idx.key}: ${e.message}`);
      else throw e;
    }
  }
}

async function rowExists(tableId, rowId) {
  try { await tables.getRow(DATABASE_ID, tableId, rowId); return true; }
  catch (e) { if (e.code === 404) return false; throw e; }
}

// ---------------------------------------------------------------- schema
const POS_ELEMENTS = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'interjection', 'phrase', 'other'];
const STATUS_ELEMENTS = ['approved', 'pending', 'archived'];
const REVIEW_STATUS_ELEMENTS = ['pending', 'approved', 'rejected'];

const TABLES = [
  {
    id: 'languages',
    name: 'Languages',
    permissions: [Permission.read(Role.any())],
    rowSecurity: false,
    columns: [
      { key: 'code', type: 'string', size: 16, required: true },       // ISO-ish code: en, hz, ...
      { key: 'name', type: 'string', size: 64, required: true },       // "Otjiherero"
      { key: 'nativeName', type: 'string', size: 64, required: false },
      { key: 'direction', type: 'enum', elements: ['ltr', 'rtl'], required: false, default: 'ltr' },
      { key: 'isActive', type: 'boolean', required: false, default: true },
      { key: 'sortOrder', type: 'integer', required: false, default: 0 },
    ],
    indexes: [{ key: 'code_unique', type: 'unique', columns: ['code'] }],
  },
  {
    id: 'words',
    name: 'Words',
    permissions: [Permission.read(Role.any())], // writes: admin/API key only (via console, key, or future Function)
    rowSecurity: true,
    columns: [
      { key: 'languageId', type: 'string', size: 16, required: true },        // language of the headword
      { key: 'word', type: 'string', size: 256, required: true },             // headword
      { key: 'pronunciation', type: 'string', size: 512, required: false },
      { key: 'definitions', type: 'string', size: 1024, required: false, array: true },
      { key: 'example', type: 'string', size: 1024, required: false },
      { key: 'partOfSpeech', type: 'enum', elements: POS_ELEMENTS, required: false },
      { key: 'synonyms', type: 'string', size: 128, required: false, array: true },
      { key: 'tags', type: 'string', size: 64, required: false, array: true },
      { key: 'status', type: 'enum', elements: STATUS_ELEMENTS, required: false, default: 'approved' },
      { key: 'likes', type: 'integer', required: false, default: 0 },          // kept for import compat; live count = word_likes rows
      { key: 'createdBy', type: 'string', size: 64, required: false },        // userId when promoted from a suggestion
      { key: 'dateAdded', type: 'datetime', required: false },
      { key: 'lastModified', type: 'datetime', required: false },
    ],
    indexes: [
      { key: 'word_search', type: 'fulltext', columns: ['word'] },
      { key: 'pronunciation_search', type: 'fulltext', columns: ['pronunciation'] },
      { key: 'definitions_search', type: 'fulltext', columns: ['definitions'], optional: true },
      { key: 'word_sort', type: 'key', columns: ['word'] },
      { key: 'date_added_sort', type: 'key', columns: ['dateAdded'] },
      { key: 'likes_sort', type: 'key', columns: ['likes'] },
      { key: 'status_idx', type: 'key', columns: ['status'] },
      { key: 'language_idx', type: 'key', columns: ['languageId'] },
      { key: 'lang_status_idx', type: 'key', columns: ['languageId', 'status'] },
    ],
  },
  {
    id: 'translations',
    name: 'Translations',
    permissions: [Permission.read(Role.any())], // writes: admin/API key only
    rowSecurity: true,
    columns: [
      { key: 'wordId', type: 'string', size: 64, required: true },            // the entry being translated
      { key: 'languageId', type: 'string', size: 16, required: true },        // target language
      { key: 'translation', type: 'string', size: 512, required: true },
      { key: 'definition', type: 'string', size: 1024, required: false },     // optional gloss in target language
      { key: 'isPrimary', type: 'boolean', required: false, default: false },
      { key: 'createdBy', type: 'string', size: 64, required: false },
    ],
    indexes: [
      { key: 'word_idx', type: 'key', columns: ['wordId'] },
      { key: 'lang_idx', type: 'key', columns: ['languageId'] },
      { key: 'word_lang_idx', type: 'key', columns: ['wordId', 'languageId'] },
    ],
  },
  {
    id: 'word_suggestions',
    name: 'Word Suggestions',
    permissions: [Permission.create(Role.users())], // users submit; read only via row-level perms / admin
    rowSecurity: true,
    columns: [
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'userName', type: 'string', size: 128, required: false },
      { key: 'languageId', type: 'string', size: 16, required: true },
      { key: 'word', type: 'string', size: 256, required: true },
      { key: 'pronunciation', type: 'string', size: 512, required: false },
      { key: 'definitions', type: 'string', size: 1024, required: false, array: true },
      { key: 'example', type: 'string', size: 1024, required: false },
      { key: 'partOfSpeech', type: 'enum', elements: POS_ELEMENTS, required: false },
      { key: 'translation', type: 'string', size: 512, required: false },     // e.g. the English meaning of a Herero word
      { key: 'notes', type: 'string', size: 2048, required: false },
      { key: 'status', type: 'enum', elements: REVIEW_STATUS_ELEMENTS, required: false, default: 'pending' },
      { key: 'reviewedBy', type: 'string', size: 64, required: false },
      { key: 'reviewedAt', type: 'datetime', required: false },
      { key: 'reviewNote', type: 'string', size: 1024, required: false },
      { key: 'createdWordId', type: 'string', size: 64, required: false },    // set when approved & promoted into words
    ],
    indexes: [
      { key: 'user_idx', type: 'key', columns: ['userId'] },
      { key: 'status_idx', type: 'key', columns: ['status'] },
      { key: 'lang_idx', type: 'key', columns: ['languageId'] },
    ],
  },
  {
    id: 'word_corrections',
    name: 'Word Corrections',
    permissions: [Permission.create(Role.users())],
    rowSecurity: true,
    columns: [
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'userName', type: 'string', size: 128, required: false },
      { key: 'wordId', type: 'string', size: 64, required: true },
      { key: 'word', type: 'string', size: 256, required: false },            // denormalized headword for easy listing
      { key: 'field', type: 'enum', elements: ['word', 'pronunciation', 'definitions', 'example', 'partOfSpeech', 'translation', 'other'], required: true },
      { key: 'currentValue', type: 'string', size: 4096, required: false },
      { key: 'suggestedValue', type: 'string', size: 4096, required: true },
      { key: 'note', type: 'string', size: 2048, required: false },
      { key: 'status', type: 'enum', elements: REVIEW_STATUS_ELEMENTS, required: false, default: 'pending' },
      { key: 'reviewedBy', type: 'string', size: 64, required: false },
      { key: 'reviewedAt', type: 'datetime', required: false },
      { key: 'reviewNote', type: 'string', size: 1024, required: false },
    ],
    indexes: [
      { key: 'user_idx', type: 'key', columns: ['userId'] },
      { key: 'word_idx', type: 'key', columns: ['wordId'] },
      { key: 'status_idx', type: 'key', columns: ['status'] },
    ],
  },
  {
    id: 'word_likes',
    name: 'Word Likes',
    permissions: [Permission.read(Role.any()), Permission.create(Role.users())],
    rowSecurity: true, // delete permission granted per-row to the owner
    columns: [
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'wordId', type: 'string', size: 64, required: true },
      { key: 'word', type: 'string', size: 256, required: false },            // denormalized for "my likes" listing
    ],
    indexes: [
      { key: 'user_idx', type: 'key', columns: ['userId'] },
      { key: 'word_idx', type: 'key', columns: ['wordId'] },
      { key: 'user_word_unique', type: 'unique', columns: ['userId', 'wordId'] },
    ],
  },
  {
    id: 'profiles',
    name: 'Profiles',
    permissions: [Permission.read(Role.any()), Permission.create(Role.users())],
    rowSecurity: true, // update/delete per-row for the owner
    columns: [
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'username', type: 'string', size: 64, required: true },
      { key: 'displayName', type: 'string', size: 128, required: false },
      { key: 'bio', type: 'string', size: 1024, required: false },
      { key: 'role', type: 'enum', elements: ['user', 'moderator', 'admin'], required: false, default: 'user' },
    ],
    indexes: [{ key: 'userId_unique', type: 'unique', columns: ['userId'] }],
  },
  {
    id: 'word_of_the_day',
    name: 'Word of the Day',
    permissions: [Permission.read(Role.any())],
    rowSecurity: false,
    columns: [
      { key: 'date', type: 'string', size: 10, required: true },              // 'YYYY-MM-DD'
      { key: 'wordId', type: 'string', size: 64, required: true },
      { key: 'languageId', type: 'string', size: 16, required: false },
      { key: 'note', type: 'string', size: 512, required: false },            // optional curator note
    ],
    indexes: [{ key: 'date_unique', type: 'unique', columns: ['date'] }],
  },
  {
    id: 'messages',
    name: 'Messages',
    permissions: [Permission.create(Role.any())], // guests can send; nobody lists via client
    rowSecurity: true,
    columns: [
      { key: 'name', type: 'string', size: 128, required: false },
      { key: 'text', type: 'string', size: 4000, required: true },
      { key: 'userId', type: 'string', size: 64, required: false },
      { key: 'isRead', type: 'boolean', required: false, default: false },
    ],
    indexes: [{ key: 'is_read_idx', type: 'key', columns: ['isRead'] }],
  },
];

// ---------------------------------------------------------------- data seeds
const LANGUAGES = [
  { rowId: 'en', data: { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr', isActive: true, sortOrder: 1 } },
  { rowId: 'hz', data: { code: 'hz', name: 'Otjiherero', nativeName: 'Otjiherero', direction: 'ltr', isActive: true, sortOrder: 2 } },
];

async function seedLanguages() {
  const existing = await tables.listRows(DATABASE_ID, 'languages', [Query.limit(10)]);
  if (existing.total > 0) { console.log('  = languages already seeded'); return; }
  for (const lang of LANGUAGES) {
    await tables.createRow(DATABASE_ID, 'languages', lang.rowId, lang.data);
  }
  console.log(`  + seeded ${LANGUAGES.length} languages (en, hz)`);
}

async function importWords() {
  const existing = await tables.listRows(DATABASE_ID, 'words', [Query.limit(1)]);
  if (existing.total > 0) { console.log('  = words already imported, skipping'); return; }

  const wordsPath = path.join(projectRoot, 'words.json');
  if (!fs.existsSync(wordsPath)) { console.log('  ! words.json not found, skipping import'); return; }
  const raw = JSON.parse(fs.readFileSync(wordsPath, 'utf8'));

  const seen = new Set();
  const rows = [];
  for (const w of raw) {
    const word = String(w.word ?? '').trim();
    if (!word) continue;
    // de-duplicate like the old app did with "-2" suffixes: keep first, suffix the rest
    let key = word.toUpperCase();
    let finalWord = word;
    if (seen.has(key)) {
      let n = 2;
      while (seen.has(`${key}-${n}`)) n++;
      finalWord = `${word}-${n}`;
      key = `${key}-${n}`;
    }
    seen.add(key);

    const definitions = (Array.isArray(w.definitions) ? w.definitions : w.definitions ? [w.definitions] : [])
      .map((d) => String(d).trim()).filter(Boolean);
    const pronunciation = String(w.pronunciation ?? '').trim();

    rows.push({
      languageId: 'en',
      word: finalWord,
      pronunciation,
      definitions,
      status: 'approved',
      likes: Number(w.likes ?? 0) || 0,
      ...(w.dateAdded ? { dateAdded: `${w.dateAdded}T00:00:00.000` } : {}),
      ...(w.lastModified ? { lastModified: `${w.lastModified}T00:00:00.000` } : {}),
    });
  }

  // bulk-create in chunks of 100
  for (let i = 0; i < rows.length; i += 100) {
    await tables.createRows(DATABASE_ID, 'words', rows.slice(i, i + 100));
  }
  console.log(`  + imported ${rows.length} words (languageId: en)`);
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function seedWordOfTheDay() {
  const date = todayISO();
  if (await rowExists('word_of_the_day', date)) { console.log('  = word_of_the_day already seeded for today'); return; }

  // pick deterministically: day number since epoch modulo total
  const totalRes = await tables.listRows(DATABASE_ID, 'words', [Query.equal('status', 'approved'), Query.limit(1)]);
  const total = totalRes.total;
  if (!total) { console.log('  ! no words to pick from, skipping WOTD seed'); return; }
  const dayIndex = Math.floor(Date.now() / 86400000) % total;
  const pick = await tables.listRows(DATABASE_ID, 'words', [
    Query.equal('status', 'approved'), Query.orderAsc('word'), Query.limit(1), Query.offset(dayIndex),
  ]);
  const word = pick.rows[0];
  if (!word) { console.log('  ! could not pick a WOTD'); return; }

  await tables.createRow(DATABASE_ID, 'word_of_the_day', date, {
    date,
    wordId: word.$id,
    languageId: word.languageId,
    note: 'Seeded automatically by setup script',
  });
  console.log(`  + seeded word_of_the_day for ${date}: "${word.word}"`);
}

// ---------------------------------------------------------------- main
console.log(`Setting up Appwrite schema at ${ENDPOINT} (project ${PROJECT_ID}, database ${DATABASE_ID})\n`);

if (!DATA_ONLY) {
  for (const def of TABLES) {
    console.log(`Table: ${def.id}`);
    await ensureTable(def);
    await ensureColumns(def);
    await ensureIndexes(def);
  }
}

if (!ONLY_SCHEMA) {
  console.log('\nSeeding data:');
  await seedLanguages();
  await importWords();
  await seedWordOfTheDay();
}

console.log('\nDone.');
