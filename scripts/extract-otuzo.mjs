/**
 * extract-otuzo.mjs
 * ------------------------------------------------------------------
 * Parses "Otuzo twOvaherero" (Ngungaa Hangara, UNAM Press 2017) into
 * dictionary rows.
 *
 * Each clan chapter opens with a labelled block:
 *
 *   Oruzo rwOhambandarwa (ohambondarwa)
 *   Ozonganda     Kahere / Kahuure / ...
 *   Ozondjupa     Rumana / Tjisekiro
 *   Ondwezu       Ombyataura
 *   Ovizerika     Kave ri eraka / ...
 *   Okuhuhurasana Omurekwa / Okoto / Omakoti
 *   Omuṱanḓu      Kahere, Karutjindo / ...
 *
 * Output:
 *   .extract/otuzo-clans.jsonl     one row per patriclan
 *   .extract/otuzo-surnames.jsonl  one row per surname -> its clan
 *
 * Then: npm run import:extract && npm run build:lexicon
 * ------------------------------------------------------------------
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PDF = path.join(projectRoot, 'Otuzo twOvaherero Ngungaa Hangara-11.pdf');
const OUT_DIR = path.join(projectRoot, '.extract');
const PYTHON = 'C:/Users/Administrator/.workbuddy-ai/binaries/python/envs/default/Scripts/python.exe';

const LABELS = [
  ['Omuṱanḓu', 'omitandu'],
  ['Omitandu', 'omitandu'],
  ['Omitango', 'omitandu'],
  ['Okuhuhurasana', 'related'],
  ['Ovizerika', 'taboos'],
  ['Ondwezu', 'totem'],
  ['Ozondjupa', 'subclans'],
  ['Ozonganda', 'surnames'],
];

// ---------------------------------------------------------------- text
function pageText() {
  const script = `
from pypdf import PdfReader
import json, sys
r = PdfReader(sys.argv[1])
print(json.dumps([(i+1, p.extract_text() or "") for i, p in enumerate(r.pages)], ensure_ascii=False))
`;
  const raw = execFileSync(PYTHON, ['-c', script, PDF], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
  return JSON.parse(raw);
}

// ---------------------------------------------------------------- parse
/** Split "Kahere" / "Katua ya Kainakuva" / "Kamaze (Otjirera)" into a headword. */
function surnameHead(raw) {
  const cleaned = raw
    .replace(/\([^)]*\)/g, ' ') // drop "(Otjirera)" annotations
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  // "Katua ya Kainakuva" -> "Katua";  "Oya Kahere" -> "Kahere"
  const first = cleaned.replace(/^Oya\s+/i, '').split(' ')[0];
  if (first.length < 3) return null;
  if (!/^[A-Za-zÀ-ÿṋṱḓḓǁ]+$/.test(first)) return null;
  return { head: first, full: cleaned };
}

function parseClanBlock(text) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+$/, ''));
  const headingIndex = lines.findIndex((l) => /^Oruzo rw/.test(l.trim()));
  if (headingIndex === -1) return null;

  const heading = lines[headingIndex].trim();
  // the table of contents lists "Oruzo rwXxx 12" — a trailing page number means
  // this is not a real chapter heading
  if (/\s\d+\s*$/.test(heading)) return null;

  const aliasMatch = heading.match(/\(([^)]+)\)/);
  const namePart = heading.replace(/^Oruzo rw/, '').replace(/\([^)]*\)/g, '').trim();
  const name = namePart.split('/')[0].replace(/\s+\d+$/, '').trim();

  const data = { name, alias: aliasMatch ? aliasMatch[1].trim() : null, surnames: [], subclans: [], totem: [], taboos: [], related: [], omitandu: [] };
  let current = null;

  for (let i = headingIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      // blank line ends the header block once we are past the labels
      if (current && data[current].length) current = null;
      continue;
    }

    const label = LABELS.find(([label]) => trimmed.startsWith(label));
    if (label) {
      current = label[1];
      const rest = trimmed.slice(label[0].length).trim();
      if (rest) data[current].push(rest);
      continue;
    }

    // continuation line: indented text belongs to the current label
    if (current && /^\s/.test(line)) {
      // stop if this looks like prose (sentence with lowercase start + many words)
      const looksLikeProse = /^[a-zḓṋṱ]/.test(trimmed) && trimmed.split(' ').length > 4;
      if (!looksLikeProse) data[current].push(trimmed);
      else current = null;
      continue;
    }

    // any other non-indented line ends the block
    if (current) current = null;
  }

  return data;
}

/** Join continuation fragments that were broken mid-word by the PDF. */
function cleanItems(items) {
  const merged = [];
  for (const item of items) {
    const prev = merged[merged.length - 1];
    if (prev && /[a-zḓṋṱ]-$/.test(prev)) merged[merged.length - 1] = prev.replace(/-$/, '') + item;
    else merged.push(item);
  }
  return merged.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

// ---------------------------------------------------------------- run
const pages = pageText();
const clans = [];
const seen = new Set();

for (const [pageNo, text] of pages) {
  if (!/^Oruzo rw/m.test(text)) continue;
  const parsed = parseClanBlock(text);
  if (!parsed || !parsed.name) continue;
  // a real chapter block always lists at least one surname or emblem
  if (!parsed.surnames.length && !parsed.totem.length) continue;
  if (seen.has(parsed.name.toLowerCase())) continue;
  seen.add(parsed.name.toLowerCase());
  clans.push({ ...parsed, page: pageNo });
}

console.log(`\n  clans parsed: ${clans.length}\n`);

fs.mkdirSync(OUT_DIR, { recursive: true });
const clanRows = [];
const surnameRows = [];

for (const clan of clans) {
  const surnames = cleanItems(clan.surnames);
  const totem = cleanItems(clan.totem);
  const taboos = cleanItems(clan.taboos);
  const related = cleanItems(clan.related);
  const omitandu = cleanItems(clan.omitandu);
  const subclans = cleanItems(clan.subclans);

  const display = clan.name;
  const definitions = [`Otjiherero patriclan (oruzo)${clan.alias ? `, also written ${clan.alias}` : ''}.`];
  if (surnames.length) definitions.push(`Surnames and homesteads (ozonganda): ${surnames.join(', ')}.`);
  if (subclans.length) definitions.push(`Sub-clans (ozondjupa): ${subclans.join(', ')}.`);
  if (totem.length) definitions.push(`Clan emblem (ondwezu): ${totem.join(', ')}.`);
  if (taboos.length) definitions.push(`Taboos (ovizerika): ${taboos.join('; ')}.`);
  if (related.length) definitions.push(`Related clans (okuhuhurasana): ${related.join(', ')}.`);
  if (omitandu.length) definitions.push(`Praise names (omiṱanḓu): ${omitandu.slice(0, 3).join(' · ')}.`);

  clanRows.push({
    word: display.toUpperCase(),
    pronunciation: `/Oruzo rw${display}.`,
    definitions,
    partOfSpeech: 'noun',
    tags: ['clan', 'oruzo', 'hangara-2017', `p${clan.page}`],
    sourcePage: clan.page,
  });

  for (const raw of surnames) {
    const parsed = surnameHead(raw);
    if (!parsed) continue;
    surnameRows.push({
      word: parsed.head.toUpperCase(),
      pronunciation: `/${parsed.head}.`,
      definitions: [
        `Surname and homestead (onganda) of the ${display} patriclan (oruzo).`,
        ...(parsed.full.toLowerCase() !== parsed.head.toLowerCase() ? [`Recorded as "${parsed.full}".`] : []),
      ],
      partOfSpeech: 'noun',
      tags: ['surname', 'onganda', 'hangara-2017', `p${clan.page}`],
      sourcePage: clan.page,
    });
  }
}

const write = (file, rows) => {
  fs.writeFileSync(
    path.join(OUT_DIR, file),
    `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`,
    'utf8',
  );
  console.log(`  ${file}: ${rows.length} rows`);
};

write('otuzo-clans.jsonl', clanRows);
write('otuzo-surnames.jsonl', surnameRows);

console.log('\n  sample clan:');
console.log('   ', JSON.stringify(clanRows[0], null, 1).slice(0, 600));
console.log('\n  sample surname:', JSON.stringify(surnameRows[0]));
console.log('\nNext: npm run import:extract && npm run build:lexicon\n');
