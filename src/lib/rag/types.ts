/**
 * Shared types for the retrieval-augmented translation pipeline.
 *
 * Pipeline:  sentence -> retriever (lexicon + live Appwrite) -> context
 *            blocks -> prompt -> LLM -> structured result
 */

export interface LexiconTerm {
  hz: string;
  classPrefix?: string | null;
  verbEnding?: string | null;
  source?: string;
}

export interface LexiconExample {
  en: string | null;
  hz: string;
  cue?: boolean;
}

export interface LexiconSubEntry {
  en: string;
  hz: string;
  classPrefix?: string | null;
}

export interface LexiconEntry {
  id: string;
  /** Headword as printed in the dictionary, e.g. "WHISTLE-2" */
  en: string;
  /** Headword without homograph suffix, e.g. "WHISTLE" */
  lemma: string;
  enNorm: string;
  qualifier?: string | null;
  pronCue?: string | null;
  /** 1-based homograph number */
  sense: number;
  terms: LexiconTerm[];
  subEntries: LexiconSubEntry[];
  examples: LexiconExample[];
  flags: string[];
}

export interface HzIndexRow {
  hz: string;
  hzNorm: string;
  en: string;
  lemma: string;
  entryId: string;
  kind: 'primary' | 'sub';
}

export interface Lexicon {
  version: number;
  generatedAt: string;
  source: string;
  stats: { entries: number; terms: number; examples: number };
  entries: LexiconEntry[];
  hzIndex: HzIndexRow[];
}

export type Direction = 'en-hz' | 'hz-en';

/**
 * One retrieved piece of evidence handed to the model. Senses of the same
 * headword are merged so the model sees every meaning at once.
 */
export interface ContextBlock {
  id: string;
  en: string;
  qualifier?: string | null;
  hz: string[];
  examples: { en: string | null; hz: string }[];
  /** English content words this block matched, for UI transparency */
  matched: string[];
  score: number;
  source: 'lexicon' | 'live';
}

export interface RetrievalResult {
  blocks: ContextBlock[];
  /** English content words with no dictionary support at all */
  uncovered: string[];
  /** All content words considered, for debugging / UI */
  contentWords: string[];
}

export interface GlossRow {
  en: string;
  hz: string;
}

export interface TranslationResult {
  /** The generated Otjiherero sentence */
  herero: string;
  /** Back-translation to English so the user can sanity-check the meaning */
  english: string;
  /** Word-by-word / phrase-by-phrase alignment */
  gloss: GlossRow[];
  /** Grammar / usage notes from the model */
  notes: string;
  confidence: number;
  /** Dictionary headwords the model was grounded in */
  sources: { en: string; hz: string[] }[];
  uncovered: string[];
  /** Which blocks the retriever supplied, for the "show context" panel */
  context: ContextBlock[];
  direction: Direction;
  model: string;
  /** true when the answer came from the local cache */
  cached: boolean;
  createdAt: string;
}

export interface RagSettings {
  /**
   * auto   - use the server proxy when deployed, otherwise the browser key
   * server - always go through /api/translate
   * byok   - always call the provider directly from the browser
   */
  mode: 'auto' | 'server' | 'byok';
  apiKey: string;
  baseUrl: string;
  model: string;
}

export class RagError extends Error {
  code:
    | 'no-key'
    | 'bad-key'
    | 'rate-limit'
    | 'network'
    | 'timeout'
    | 'bad-response'
    | 'server'
    | 'unknown';

  constructor(code: RagError['code'], message: string) {
    super(message);
    this.name = 'RagError';
    this.code = code;
  }
}
