/**
 * grant-admin-access.mjs
 * ------------------------------------------------------------------
 * Creates the admin-only tables (word_drafts, app_settings) and applies
 * `label:admin` permissions across the schema so users carrying the
 * `admin` label (Appwrite console → Users → Labels) can manage content
 * from the browser — no API keys in the client.
 *
 * Idempotent: safe to run repeatedly.
 *
 * Usage: node scripts/grant-admin-access.mjs
 * ------------------------------------------------------------------
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, TablesDB, Permission, Role, Query } from 'node-appwrite';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  fs.readFileSync(path.join(projectRoot, '.env'), 'utf8')
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
const API_KEY = env.APPWRITE_API_KEY || env.VITE_APPWRITE_DATABASE_API_KEY;

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
const tables = new TablesDB(client);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RETRY_CODES = [404, 500, 502, 503, 504];

async function retry(fn, { attempts = 5, delayMs = 1500 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      if (!RETRY_CODES.includes(e.code)) throw e;
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
    } catch { /* not registered yet */ }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for column ${tableId}.${key}`);
}

const ADMIN = [
  Permission.read(Role.label('admin')),
  Permission.create(Role.label('admin')),
  Permission.update(Role.label('admin')),
  Permission.delete(Role.label('admin')),
];

// Final permission sets per table (label:admin added to existing public/user perms)
const TABLE_PERMISSIONS = {
  languages: [Permission.read(Role.any()), ...ADMIN],
  words: [Permission.read(Role.any()), ...ADMIN],
  translations: [Permission.read(Role.any()), ...ADMIN],
  word_suggestions: [
    Permission.create(Role.users()),
    ...ADMIN, // read/update/delete for admins
  ],
  word_corrections: [
    Permission.create(Role.users()),
    ...ADMIN,
  ],
  word_likes: [
    Permission.read(Role.any()),
    Permission.create(Role.users()),
    Permission.delete(Role.label('admin')),
  ],
  profiles: [Permission.read(Role.any()), Permission.create(Role.users()), ...ADMIN],
  word_of_the_day: [Permission.read(Role.any()), ...ADMIN],
  messages: [Permission.create(Role.any()), ...ADMIN],
};

const NEW_TABLES = [
  {
    id: 'word_drafts',
    name: 'Word Drafts (AI)',
    permissions: ADMIN, // never public
    rowSecurity: false, // table-level perms gate everything → anon gets 401, not an empty list
    columns: [
      { key: 'sourceType', type: 'enum', elements: ['image', 'pdf', 'text'], required: true },
      { key: 'sourceName', type: 'string', size: 256, required: false },
      { key: 'model', type: 'string', size: 64, required: false },
      { key: 'entriesJson', type: 'string', size: 65535, required: true }, // full extracted entries array
      { key: 'rawPreview', type: 'string', size: 4000, required: false },
      { key: 'entryCount', type: 'integer', required: false, default: 0 },
      { key: 'status', type: 'enum', elements: ['pending', 'approved', 'discarded'], required: false, default: 'pending' },
      { key: 'approvedWordIds', type: 'string', size: 64, required: false, array: true },
      { key: 'error', type: 'string', size: 2000, required: false },
      { key: 'createdBy', type: 'string', size: 64, required: false },
    ],
    indexes: [
      { key: 'status_idx', type: 'key', columns: ['status'] },
      { key: 'user_idx', type: 'key', columns: ['createdBy'] },
    ],
  },
  {
    id: 'app_settings',
    name: 'App Settings',
    permissions: ADMIN, // never public
    rowSecurity: false,
    columns: [
      { key: 'key', type: 'string', size: 64, required: true },
      { key: 'value', type: 'string', size: 4000, required: true },
      { key: 'updatedBy', type: 'string', size: 64, required: false },
    ],
    indexes: [{ key: 'key_unique', type: 'unique', columns: ['key'] }],
  },
];

console.log(`Applying admin access at ${ENDPOINT} (database ${DATABASE_ID})\n`);

// 1. create the two new admin tables
for (const def of NEW_TABLES) {
  console.log(`Table: ${def.id}`);
  try {
    const existing = await retry(() => tables.getTable(DATABASE_ID, def.id), { attempts: 2, delayMs: 800 });
    // keep security config in sync on re-runs
    await tables.updateTable(DATABASE_ID, def.id, undefined, def.permissions, def.rowSecurity);
    console.log('  = table exists (perms refreshed)');
  } catch (e) {
    if (e.code !== 404) throw e;
    try {
      await tables.createTable(DATABASE_ID, def.id, def.name, def.permissions, def.rowSecurity);
      console.log('  + created table');
    } catch (e2) {
      if (e2.code !== 409) throw e2;
      console.log('  = table exists (race)');
    }
    await sleep(1500);
  }

  const existingCols = new Map();
  const cols = await retry(() => tables.listColumns(DATABASE_ID, def.id));
  cols.columns.forEach((c) => existingCols.set(c.key, c));
  for (const col of def.columns) {
    if (existingCols.has(col.key)) { console.log(`    = column ${col.key}`); continue; }
    const args = [DATABASE_ID, def.id, col.key];
    switch (col.type) {
      case 'string':
        await tables.createStringColumn(...args, col.size, col.required, col.default ?? undefined, col.array ?? false);
        break;
      case 'enum':
        await tables.createEnumColumn(...args, col.elements, col.required, col.default ?? undefined, col.array ?? false);
        break;
      case 'integer':
        await tables.createIntegerColumn(...args, col.required, col.min ?? undefined, col.max ?? undefined, col.default ?? undefined, col.array ?? false);
        break;
      default:
        throw new Error(`Unknown type ${col.type}`);
    }
    console.log(`    + column ${col.key}`);
  }
  for (const col of def.columns) await waitForColumn(def.id, col.key);

  const existingIdx = new Set();
  const idx = await retry(() => tables.listIndexes(DATABASE_ID, def.id));
  idx.indexes.forEach((i) => existingIdx.add(i.key));
  for (const i of def.indexes) {
    if (existingIdx.has(i.key)) { console.log(`    = index ${i.key}`); continue; }
    await tables.createIndex(DATABASE_ID, def.id, i.key, i.type, i.columns);
    console.log(`    + index ${i.key}`);
  }
}

// 2. apply permissions everywhere (additive label:admin)
console.log('\nPermissions:');
for (const [tableId, perms] of Object.entries(TABLE_PERMISSIONS)) {
  try {
    await tables.updateTable(DATABASE_ID, tableId, undefined, perms);
    console.log(`  = ${tableId} (admin label perms applied)`);
  } catch (e) {
    console.error(`  ! ${tableId}: ${e.message}`);
  }
}

console.log('\nDone. Users with the "admin" label can now manage content from the /admin panel.');
