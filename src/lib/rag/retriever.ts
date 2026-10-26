/**
 * Hybrid lexical retriever.
 *
 * Why lexical and not a vector index: the dictionary is small (hundreds to a
 * few thousand entries) and the query is a whole sentence, so what matters is
 * recall on *specific* content words, not fuzzy topical similarity. A dense
 * index over a 116-entry corpus mostly retrieves neighbours that share a topic
 * but not the term needed for the sentence. BM25 + morphology + typo tolerance
 * is both cheaper and more precise here.
 *
 * The retriever is a pure function of (lexicon, query) so it can be unit
 * tested without network access. Live Appwrite hits are fetched separately
 * and merged in `translate.ts`.
 */

import type { ContextBlock, Direction, Lexicon, RetrievalResult } from './types';
import {
  buildSearchDocs,
  computeIdf,
  contentWords,
  editDistance,
  stem,
  stemHz,
  tokenize,
  type SearchDoc,
} from './lexicon';

const DEFAULT_K = 10;

function emptyResult(): RetrievalResult {
  return { blocks: [], uncovered: [], contentWords: [] };
}

/** Merge same-lemma senses into a single context block. */
function groupBlocks(docs: { doc: SearchDoc; score: number; matched: Set<string> }[]): ContextBlock[] {
  const byLemma = new Map<string, ContextBlock>();

  for (const { doc, score, matched } of docs) {
    const { entry } = doc;
    const key = entry.lemma.toLowerCase();
    const existing = byLemma.get(key);

    const hzTerms = entry.terms.map((t) => t.hz);
    const examples = entry.examples.map((x) => ({ en: x.en, hz: x.hz }));

    if (!existing) {
      byLemma.set(key, {
        id: entry.id,
        en: entry.lemma,
        qualifier: entry.qualifier ?? null,
        hz: [...new Set(hzTerms)],
        examples,
        matched: [...matched],
        score,
        source: 'lexicon',
      });
    } else {
      existing.score = Math.max(existing.score, score);
      for (const hz of hzTerms) if (!existing.hz.includes(hz)) existing.hz.push(hz);
      for (const ex of examples) {
        if (existing.examples.length >= 3) break;
        if (!existing.examples.some((e) => e.hz === ex.hz)) existing.examples.push(ex);
      }
      for (const m of matched) if (!existing.matched.includes(m)) existing.matched.push(m);
    }
  }

  return [...byLemma.values()].sort((a, b) => b.score - a.score);
}

/**
 * Retrieve dictionary entries relevant to a sentence or phrase.
 *
 * @param lexicon   the loaded lexicon
 * @param query     the sentence in the source language
 * @param direction 'en-hz' searches the English side, 'hz-en' the Herero side
 * @param k         maximum number of distinct headwords to return
 */
export function retrieve(
  lexicon: Lexicon,
  query: string,
  direction: Direction = 'en-hz',
  k = DEFAULT_K,
): RetrievalResult {
  if (!lexicon?.entries?.length) return emptyResult();

  const docs = buildSearchDocs(lexicon);
  const idf = computeIdf(docs);
  const n = Math.max(1, docs.length);
  const idfOf = (token: string) => idf.get(token) ?? Math.log(1 + n);

  const hzMode = direction === 'hz-en';
  // Herero has no English stopwords, so keep every token of two letters or more.
  const words = hzMode
    ? [...new Set(tokenize(query).filter((t) => t.length >= 2))]
    : contentWords(query);

  if (!words.length) return emptyResult();

  const phrase = String(query ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  const scored = new Map<SearchDoc, { score: number; matched: Set<string> }>();
  const hitTokens = new Set<string>();

  for (const word of words) {
    const key = hzMode ? stemHz(word) : stem(word);
    const weight = idfOf(key);

    for (const doc of docs) {
      let add = 0;

      if (hzMode) {
        const exact = doc.hzTokens.get(word) ?? 0;
        const stemmed = key !== word ? doc.hzTokens.get(key) ?? 0 : 0;
        if (exact || stemmed) {
          add = (exact + stemmed) * weight;
        } else if (word.length >= 4) {
          // tolerate inflection/typos on the Herero side
          for (const hzToken of doc.hzTokens.keys()) {
            if (hzToken.length >= 4 && editDistance(word, hzToken, 1) <= 1) {
              add = 1.5 * weight;
              break;
            }
          }
        }
      } else {
        const exact = doc.enTokens.get(key) ?? 0;
        if (exact) {
          add = exact * weight;
        } else if (word.length >= 4) {
          const lemma = doc.entry.lemma.toLowerCase();
          const prefix = word.slice(0, Math.min(4, word.length));
          if (lemma.startsWith(prefix)) {
            add = 2 * weight;
          } else if (lemma.length >= 4 && editDistance(key, stem(lemma), 1) <= 1) {
            add = 1.5 * weight;
          } else {
            // last resort: near-miss against any indexed English token
            for (const enToken of doc.enTokens.keys()) {
              if (enToken.length >= 4 && editDistance(key, enToken, 1) <= 1) {
                add = weight;
                break;
              }
            }
          }
        }
      }

      if (add > 0) {
        hitTokens.add(word);
        const bucket = scored.get(doc) ?? { score: 0, matched: new Set<string>() };
        bucket.score += add;
        bucket.matched.add(word);
        scored.set(doc, bucket);
      }
    }
  }

  // phrase bonus: the query literally contains the headword
  if (!hzMode) {
    for (const [doc, bucket] of scored) {
      const lemma = doc.entry.lemma.toLowerCase();
      if (lemma.includes(' ') ? phrase.includes(lemma) : new RegExp(`\\b${lemma.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(phrase)) {
        bucket.score += 6;
      }
    }
  }

  // coverage bonus: prefer entries that explain more of the sentence
  const total = words.length;
  for (const bucket of scored.values()) {
    bucket.score += 4 * (bucket.matched.size / total);
  }

  const ranked = [...scored.entries()]
    .map(([doc, bucket]) => ({ doc, score: bucket.score, matched: bucket.matched }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(k * 3, 24)); // over-fetch, grouping collapses senses

  const blocks = groupBlocks(ranked).slice(0, k);
  const uncovered = words.filter((w) => !hitTokens.has(w));

  return { blocks, uncovered, contentWords: words };
}

export interface WordLookupHit {
  en: string;
  hz: string;
  classPrefix?: string | null;
  examples: { en: string | null; hz: string }[];
  score: number;
  matchType: 'exact' | 'prefix' | 'stem' | 'fuzzy';
}

export interface WordLookupResult {
  direction: Direction;
  query: string;
  hits: WordLookupHit[];
}

/**
 * Dictionary-style lookup for a single word, in either direction.
 * Runs fully offline against the bundled lexicon — no API key needed.
 */
export function lookupWord(
  lexicon: Lexicon,
  rawQuery: string,
  direction: Direction = 'en-hz',
  limit = 8,
): WordLookupResult {
  const query = String(rawQuery ?? '').trim();
  if (!lexicon?.entries?.length || !query) {
    return { direction, query, hits: [] };
  }

  const hits: WordLookupHit[] = [];

  if (direction === 'en-hz') {
    const q = query.toLowerCase();
    const qStem = stem(q);
    for (const entry of lexicon.entries) {
      const lemma = entry.lemma.toLowerCase();
      const lemmaStem = stem(lemma);
      let matchType: WordLookupHit['matchType'] | null = null;

      if (lemma === q || lemmaStem === qStem) matchType = 'exact';
      else if (lemma.startsWith(q) || (q.length >= 4 && q.startsWith(lemma))) matchType = 'prefix';
      else if (lemma.length >= 4 && editDistance(q, lemma, 1) <= 1) matchType = 'fuzzy';
      if (!matchType) continue;

      for (const term of entry.terms) {
        hits.push({
          en: entry.en,
          hz: term.hz,
          classPrefix: term.classPrefix ?? null,
          examples: entry.examples.map((x) => ({ en: x.en, hz: x.hz })),
          score: matchType === 'exact' ? 3 : matchType === 'prefix' ? 2 : 1,
          matchType,
        });
      }
      for (const sub of entry.subEntries) {
        if (matchType !== 'exact') continue; // sub-entries only on exact headword hits
        hits.push({
          en: `${entry.lemma} (${sub.en})`,
          hz: sub.hz,
          classPrefix: sub.classPrefix ?? null,
          examples: [],
          score: 1,
          matchType: 'stem',
        });
      }
    }
  } else {
    const qNorm = query.toLowerCase().replace(/[^a-zà-ÿ]/g, '');
    const qStem = stemHz(qNorm);
    const entryById = new Map(lexicon.entries.map((e) => [e.id, e]));

    for (const row of lexicon.hzIndex) {
      let matchType: WordLookupHit['matchType'] | null = null;
      if (row.hzNorm === qNorm) matchType = 'exact';
      else if (row.hzNorm.startsWith(qNorm) && qNorm.length >= 3) matchType = 'prefix';
      else if (stemHz(row.hzNorm) === qStem && qStem.length >= 3) matchType = 'stem';
      else if (row.hzNorm.length >= 4 && editDistance(qNorm, row.hzNorm, 1) <= 1) matchType = 'fuzzy';
      if (!matchType) continue;

      const entry = entryById.get(row.entryId);
      hits.push({
        en: row.lemma,
        hz: row.hz,
        classPrefix: entry?.terms.find((t) => t.hz === row.hz)?.classPrefix ?? null,
        examples: entry?.examples.map((x) => ({ en: x.en, hz: x.hz })) ?? [],
        score: matchType === 'exact' ? 3 : matchType === 'prefix' ? 2 : 1,
        matchType,
      });
    }
  }

  const deduped: WordLookupHit[] = [];
  const seen = new Set<string>();
  for (const hit of hits.sort((a, b) => b.score - a.score)) {
    const key = `${hit.en}|${hit.hz}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(hit);
  }

  return { direction, query, hits: deduped.slice(0, limit) };
}
