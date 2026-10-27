/**
 * test-mcp.mjs — drives the bundled MCP server over stdio with real
 * JSON-RPC: handshake, tools/list, tools/call on every tool.
 *   npm run test:mcp
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expectedEntryCount = JSON.parse(
  fs.readFileSync(path.join(projectRoot, 'public', 'lexicon.json'), 'utf8'),
).stats.entries;
const child = spawn(process.execPath, [path.join(projectRoot, 'dist-mcp', 'mcp-server.mjs')], {
  env: process.env,
  stdio: ['pipe', 'pipe', 'pipe'],
});

let buffer = '';
const pending = new Map();
let nextId = 1;

child.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  let index;
  while ((index = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch {}
  }
});
child.stderr.on('data', (c) => process.stderr.write(`  [server] ${c}`));

function request(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, resolve);
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`timeout waiting for ${method}`));
      }
    }, 15000);
  });
}

function notify(method, params) {
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);
}

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

// handshake
const init = await request('initialize', {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'test-client', version: '1.0.0' },
});
check('initialize', init.result?.serverInfo?.name === 'otjiherero-dictionary', `v${init.result?.serverInfo?.version}`);
notify('notifications/initialized');

// tools/list
const list = await request('tools/list', {});
const names = (list.result?.tools ?? []).map((t) => t.name).sort();
check(
  'tools/list',
  JSON.stringify(names) === JSON.stringify(['get_lexicon_stats', 'lookup_word', 'search_dictionary', 'translate_sentence']),
  names.join(', '),
);

// resources/list
const resources = await request('resources/list', {});
check('resources/list', (resources.result?.resources ?? []).some((r) => r.uri === 'dictionary://lexicon'));

async function call(name, args) {
  const res = await request('tools/call', { name, arguments: args });
  const text = res.result?.content?.[0]?.text ?? '';
  return { isError: res.result?.isError === true, text };
}

// lookup_word (offline)
const lookup = JSON.parse((await call('lookup_word', { word: 'woman' })).text);
check('lookup_word en-hz', lookup.hits?.[0]?.herero === 'omukazendu' && lookup.hits[0].pluralClassPrefix === 'ova', JSON.stringify(lookup.hits?.[0]));
const lookupHz = JSON.parse((await call('lookup_word', { word: 'otjivike', direction: 'hz-en' })).text);
check('lookup_word hz-en', lookupHz.hits?.[0]?.english === 'WEEK', JSON.stringify(lookupHz.hits?.[0]));

// search_dictionary (offline retrieval)
const search = JSON.parse((await call('search_dictionary', { query: 'The child is wet.' })).text);
check(
  'search_dictionary',
  search.entries?.some((e) => e.headword === 'WET'),
  search.entries?.map((e) => e.headword).slice(0, 3).join(', '),
);
check('search_dictionary uncovers gaps', Array.isArray(search.uncovered), `uncovered: ${search.uncovered?.join(', ') || '(none)'}`);
// deliberately modern vocabulary: absent from a 1983 dictionary, so it must
// surface as "uncovered" rather than being silently guessed
const gaps = JSON.parse((await call('search_dictionary', { query: 'The astronaut repaired the satellite.' })).text);
check(
  'search_dictionary reports missing words',
  gaps.uncovered?.includes('astronaut') && gaps.uncovered?.includes('satellite'),
  gaps.uncovered?.join(', '),
);

// translate_sentence without a key -> friendly guidance, not a crash
const noKey = await call('translate_sentence', { text: 'The child is wet.' });
check(
  'translate_sentence without key',
  !noKey.isError && /LLM_API_KEY/.test(noKey.text),
  noKey.text.slice(0, 80),
);

// get_lexicon_stats
const stats = JSON.parse((await call('get_lexicon_stats', {})).text);
check(
  'get_lexicon_stats',
  stats.entries === expectedEntryCount && stats.translationEnabled === false,
  `${stats.entries} entries, ${stats.hereroTerms} terms, flagged: ${stats.flaggedForReview.length}`,
);

child.kill();
console.log(`\n  ${failures === 0 ? 'All MCP checks passed.' : `${failures} MCP check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
