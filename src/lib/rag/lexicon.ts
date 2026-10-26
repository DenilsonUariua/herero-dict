/**
 * Lexicon loading + text normalisation shared by the retriever.
 *
 * The lexicon is a static asset (`/lexicon.json`) generated from the
 * dictionary source by `npm run build:lexicon`. It is fetched once per
 * session and kept in memory; the browser HTTP cache handles the rest.
 */

import type { Lexicon, LexiconEntry } from './types';

let cache: Lexicon | null = null;
let inflight: Promise<Lexicon> | null = null;

const EMPTY: Lexicon = {
  version: 1,
  generatedAt: '',
  source: 'none',
  stats: { entries: 0, terms: 0, examples: 0 },
  entries: [],
  hzIndex: [],
};

/** Fetch and memoise `/lexicon.json`. Never throws — returns an empty lexicon. */
export async function loadLexicon(): Promise<Lexicon> {
  if (cache) return cache;
  if (inflight) return inflight;

  const base = import.meta.env.BASE_URL || '/';
  const url = `${base.replace(/\/$/, '')}/lexicon.json`;

  inflight = fetch(url, { cache: 'force-cache' })
    .then(async (res) => {
      if (!res.ok) throw new Error(`lexicon.json ${res.status}`);
      const data = (await res.json()) as Lexicon;
      cache = { ...EMPTY, ...data, entries: data.entries ?? [], hzIndex: data.hzIndex ?? [] };
      return cache;
    })
    .catch((err) => {
      console.warn('[rag] could not load lexicon:', err);
      cache = EMPTY;
      return cache as Lexicon;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function getCachedLexicon(): Lexicon | null {
  return cache;
}

// ------------------------------------------------------------------ text

const STOPWORDS = new Set(
  `a an the is are was were be been being am do does did doing done have has had having
   to of in on at for with and or but nor so yet if then than that this these those there here
   i you he she it we they me him her us them my your his its our their mine yours
   not no yes very really just also too only own same both few many much more most
   will shall can could would should may might must ought
   from by as into over under up down out off about above below between through during
   before after again once all any each every other some such
   what when where who whom which why how`
    .split(/\s+/)
    .filter(Boolean),
);

export function isStopword(token: string): boolean {
  return STOPWORDS.has(token);
}

/** Split text into lowercase word tokens, keeping letters incl. Herero diacritics. */
export function tokenize(text: string): string[] {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-zà-ÿ']+/g, ' ')
    .split(' ')
    .filter(Boolean);
}

/** Content words only (stopwords removed), de-duplicated, order preserved. */
export function contentWords(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of tokenize(text)) {
    if (t.length < 2 || isStopword(t) || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * Very light English stemmer — enough to match "working"/"worked"/"works"
 * to "WORK". Deliberately conservative: no dictionary lookups.
 */
export function stem(token: string): string {
  let t = token;
  if (t.length > 4 && t.endsWith('ies')) return `${t.slice(0, -3)}y`;
  if (t.length > 4 && t.endsWith('es')) t = t.slice(0, -2);
  else if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) t = t.slice(0, -1);
  if (t.length > 5 && t.endsWith('ing')) t = t.slice(0, -3);
  else if (t.length > 4 && t.endsWith('ed')) t = t.slice(0, -2);
  if (t.length > 5 && t.endsWith('ly')) t = t.slice(0, -2);
  return t;
}

/** Otjiherero noun-class prefixes, longest first so "otji" wins over "o". */
const HZ_PREFIXES = [
  'otji', 'ovyo', 'omu', 'ova', 'omi', 'oma', 'oru', 'otu', 'oku', 'oka', 'ou', 'ozo', 'oza',
  'oze', 'eze', 'eyi', 'omo', 'omo', 'o', 'e', 'u', 'i', 'a',
];

/**
 * Strip a noun-class prefix to get a comparable stem.
 * "otjivike" -> "vike", "ovandu" -> "vandu", "ombepo" -> "mbepo".
 * Keeps at least 3 characters so short words are not destroyed.
 */
export function stemHz(word: string): string {
  const w = String(word ?? '').toLowerCase().replace(/[^a-zà-ÿ]/g, '');
  for (const p of HZ_PREFIXES) {
    if (w.startsWith(p) && w.length - p.length >= 3) return w.slice(p.length);
  }
  return w;
}

/** Levenshtein distance, used for typo-tolerant matching. */
export function editDistance(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diag + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diag = tmp;
    }
  }
  return prev[b.length];
}

// ------------------------------------------------------------------ docs

export interface SearchDoc {
  entry: LexiconEntry;
  /** Weighted English-side tokens (lemma, qualifier, sub-entries, examples) */
  enTokens: Map<string, number>;
  /** Weighted Herero-side tokens */
  hzTokens: Map<string, number>;
  /** Lowercased headword phrase, used for phrase bonuses */
  enPhrase: string;
}

function addTokens(map: Map<string, number>, text: string | null | undefined, weight: number) {
  if (!text) return;
  for (const raw of tokenize(text)) {
    if (raw.length < 2) continue;
    const key = stem(raw);
    map.set(key, (map.get(key) ?? 0) + weight);
  }
}

/** Build weighted token bags for every lexicon entry. Memoised per lexicon. */
const docCache = new WeakMap<Lexicon, SearchDoc[]>();

export function buildSearchDocs(lexicon: Lexicon): SearchDoc[] {
  const cached = docCache.get(lexicon);
  if (cached) return cached;

  const docs: SearchDoc[] = lexicon.entries.map((entry) => {
    const enTokens = new Map<string, number>();
    const hzTokens = new Map<string, number>();

    // headword carries the most weight, qualifiers and sub-entries next
    addTokens(enTokens, entry.lemma, 4);
    addTokens(enTokens, entry.qualifier, 3);
    if (entry.pronCue) addTokens(enTokens, entry.pronCue, 2);
    for (const sub of entry.subEntries) addTokens(enTokens, sub.en, 3);
    for (const ex of entry.examples) {
      if (ex.en) addTokens(enTokens, ex.en, 1);
    }

    for (const term of entry.terms) {
      addTokens(hzTokens, term.hz, 4);
      addTokens(hzTokens, stemHz(term.hz), 4);
    }
    for (const sub of entry.subEntries) {
      addTokens(hzTokens, sub.hz, 3);
      addTokens(hzTokens, stemHz(sub.hz), 3);
    }
    for (const ex of entry.examples) addTokens(hzTokens, ex.hz, 1);

    return {
      entry,
      enTokens,
      hzTokens,
      enPhrase: entry.lemma.toLowerCase().replace(/\s+/g, ' ').trim(),
    };
  });

  docCache.set(lexicon, docs);
  return docs;
}

/** Inverse document frequency over the English token bags. */
export function computeIdf(docs: SearchDoc[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const doc of docs) {
    for (const key of doc.enTokens.keys()) df.set(key, (df.get(key) ?? 0) + 1);
    for (const key of doc.hzTokens.keys()) df.set(key, (df.get(key) ?? 0) + 1);
  }
  const idf = new Map<string, number>();
  const n = Math.max(1, docs.length);
  for (const [key, count] of df) idf.set(key, Math.log(1 + n / count));
  return idf;
}
