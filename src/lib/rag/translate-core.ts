/**
 * Platform-neutral translation orchestration: retrieve -> augment -> generate
 * -> validate -> cache.
 *
 * This module deliberately has NO dependency on the Appwrite client or on
 * `import.meta.env`, so the same pipeline runs in the browser and in plain
 * Node (the MCP server bundles it with esbuild).
 *
 * Callers inject their environment:
 *  - `lexicon`    pass a pre-loaded lexicon (Node reads it from disk), or
 *                 omit it and /lexicon.json is fetched (browser)
 *  - `liveFetch`  optional live-dictionary fusion (browser wires the
 *                 Appwrite full-text search here; the MCP server omits it)
 */

import { loadLexicon } from './lexicon';
import { retrieve, lookupWord, type WordLookupResult } from './retriever';
import { buildMessages } from './prompt';
import { requestCompletion, TRUNCATED_MESSAGE } from './provider';
import {
  RagError,
  type ContextBlock,
  type Direction,
  type GlossRow,
  type Lexicon,
  type RagSettings,
  type TranslationResult,
} from './types';

const CONTEXT_K = 10;
const CACHE_KEY = 'herero_rag_cache_v1';
const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const CACHE_MAX = 80;

export type TranslateStage = 'retrieving' | 'generating' | 'validating';

export interface TranslateCoreOptions {
  text: string;
  direction: Direction;
  settings: RagSettings;
  signal?: AbortSignal;
  onStage?: (stage: TranslateStage) => void;
  /** Skip the local cache (used by the "regenerate" button) */
  bypassCache?: boolean;
  /** Pre-loaded lexicon; omit in the browser to fetch /lexicon.json */
  lexicon?: Lexicon;
  /** Optional live-dictionary fusion, e.g. Appwrite full-text search */
  liveFetch?: (contentWords: string[]) => Promise<ContextBlock[]>;
}

// ------------------------------------------------------------------ cache

interface CacheEntry {
  result: TranslationResult;
  ts: number;
}

function readCache(): Record<string, CacheEntry> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function writeCache(entries: Record<string, CacheEntry>) {
  try {
    const keys = Object.keys(entries);
    if (keys.length > CACHE_MAX) {
      keys
        .sort((a, b) => entries[a].ts - entries[b].ts)
        .slice(0, keys.length - CACHE_MAX)
        .forEach((k) => delete entries[k]);
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
  } catch {
    /* quota — cache is an optimisation only */
  }
}

function hashKey(direction: Direction, model: string, text: string): string {
  const input = `${direction}|${model}|${text.trim().toLowerCase()}`;
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return `${direction}:${(h >>> 0).toString(36)}`;
}

export function clearTranslationCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

// ------------------------------------------------------------------ parsing

function stripFences(raw: string): string {
  let text = String(raw ?? '').trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  if (text.startsWith('{')) return text;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  return text;
}

/**
 * Append the closing brackets a model forgot.
 *
 * Some models emit a complete object but drop the final `}`. That is worth
 * recovering because nothing has to be invented to fix it. A reply cut off
 * mid-string cannot be recovered this way and returns null, so callers still
 * report a real error instead of showing half a sentence.
 */
function closeUnbalancedJson(raw: string): string | null {
  const text = stripFences(raw);
  const start = text.indexOf('{');
  if (start === -1) return null;

  const body = text.slice(start);
  const closers: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') closers.push('}');
    else if (ch === '[') closers.push(']');
    else if (ch === '}' || ch === ']') {
      if (closers.pop() !== ch) return null;
    }
  }

  // mid-string cut, or already balanced (so the failure is elsewhere)
  if (inString || closers.length === 0) return null;

  return body.replace(/[\s,]+$/, '') + closers.reverse().join('');
}

/** Parse the model's JSON, tolerating code fences and a missing final brace. */
function parseObject(raw: string, truncated: boolean): Record<string, unknown> {
  for (const candidate of [stripFences(raw), closeUnbalancedJson(raw)]) {
    if (!candidate) continue;
    try {
      const value = JSON.parse(candidate);
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
      }
    } catch {
      /* try the next candidate */
    }
  }
  throw new RagError(
    'bad-response',
    truncated
      ? TRUNCATED_MESSAGE
      : 'The model did not return usable JSON. Try again, or switch to a more capable model.',
  );
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v ?? '').trim()).filter(Boolean);
}

function asGloss(value: unknown): GlossRow[] {
  if (!Array.isArray(value)) return [];
  const rows: GlossRow[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const en = asString((item as Record<string, unknown>).en);
    const hz = asString((item as Record<string, unknown>).hz);
    if (en || hz) rows.push({ en, hz });
  }
  return rows;
}

// ------------------------------------------------------------------ api

export async function translateSentence(options: TranslateCoreOptions): Promise<TranslationResult> {
  const text = String(options.text ?? '').trim();
  const { direction, settings, signal, onStage, bypassCache, liveFetch } = options;

  if (!text) throw new RagError('unknown', 'Enter a sentence to translate.');
  if (text.length > 1200) throw new RagError('unknown', 'Please keep sentences under 1200 characters.');

  const cacheKey = hashKey(direction, settings.model, text);
  if (!bypassCache) {
    const entry = readCache()[cacheKey];
    if (entry && Date.now() - entry.ts < CACHE_TTL_MS) {
      return { ...entry.result, cached: true };
    }
  }

  onStage?.('retrieving');
  const lexicon = options.lexicon ?? (await loadLexicon());
  const retrieval = retrieve(lexicon, text, direction, CONTEXT_K);

  let blocks = retrieval.blocks;
  if (liveFetch) {
    // pull in words added since the last lexicon build (best effort),
    // de-duplicating against the static retrieval and keeping its ranking
    const live = await liveFetch(retrieval.contentWords);
    const seen = new Set(blocks.map((b) => b.en.toLowerCase()));
    for (const block of live) {
      const key = block.en.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      blocks.push(block);
    }
    blocks = blocks.slice(0, CONTEXT_K);
  }

  if (signal?.aborted) throw new RagError('unknown', 'Translation cancelled.');

  onStage?.('generating');
  const messages = buildMessages({
    text,
    direction,
    blocks,
    uncovered: retrieval.uncovered,
  });

  const completion = await requestCompletion({ messages, settings, signal });

  onStage?.('validating');
  const parsed = parseObject(completion.text, Boolean(completion.truncated));

  const usedEntries = asStringArray(parsed.usedEntries).map((s) => s.toUpperCase());
  const sources = blocks
    .filter((b) => usedEntries.length === 0 || usedEntries.includes(b.en.toUpperCase()))
    .slice(0, 8)
    .map((b) => ({ en: b.en, hz: b.hz }));

  const confidenceRaw = Number(parsed.confidence);
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.min(1, Math.max(0, confidenceRaw > 1 ? confidenceRaw / 100 : confidenceRaw))
    : 0.5;

  const modelUncovered = asStringArray(parsed.uncovered);
  const uncovered = [...new Set([...retrieval.uncovered, ...modelUncovered.map((w) => w.toLowerCase())])];

  const result: TranslationResult = {
    herero: asString(parsed.herero),
    english: asString(parsed.english),
    gloss: asGloss(parsed.gloss),
    notes: asString(parsed.notes),
    confidence,
    sources,
    uncovered,
    context: blocks,
    direction,
    model: completion.model,
    cached: false,
    createdAt: new Date().toISOString(),
  };

  if (!result.herero) {
    throw new RagError('bad-response', 'The model returned an empty translation.');
  }

  if (completion.truncated) {
    // the object was salvageable but the model stopped early, so say so
    const warning = 'Note: the model hit its output-token limit, so this answer may be incomplete.';
    result.notes = result.notes ? `${result.notes} ${warning}` : warning;
  }

  const cache = readCache();
  cache[cacheKey] = { result, ts: Date.now() };
  writeCache(cache);

  return result;
}

/** Bidirectional word lookup — no API key, no network. */
export async function translateWord(
  word: string,
  direction: Direction,
  lexicon?: Lexicon,
  limit = 8,
): Promise<WordLookupResult> {
  const loaded = lexicon ?? (await loadLexicon());
  return lookupWord(loaded, word, direction, limit);
}
