/**
 * Browser entry point for the translation pipeline.
 *
 * Wires the platform-neutral core (`translate-core.ts`) to browser-specific
 * services: fetching `/lexicon.json` and fusing in live Appwrite words.
 * The MCP server uses the core directly instead of this module.
 */

import { loadLexicon } from './lexicon';
import {
  translateSentence as translateSentenceCore,
  translateWord as translateWordCore,
  type TranslateCoreOptions,
} from './translate-core';
import { fetchLiveBlocks } from './live';

export type { TranslateStage } from './translate-core';
export { clearTranslationCache } from './translate-core';

export type TranslateOptions = Omit<TranslateCoreOptions, 'lexicon' | 'liveFetch'>;

export async function translateSentence(options: TranslateOptions) {
  const lexicon = await loadLexicon();
  return translateSentenceCore({
    ...options,
    lexicon,
    liveFetch: (contentWords) => fetchLiveBlocks(contentWords, { signal: options.signal }),
  });
}

export async function translateWord(word: string, direction: 'en-hz' | 'hz-en', limit = 8) {
  const lexicon = await loadLexicon();
  return translateWordCore(word, direction, lexicon, limit);
}

/** Metadata about the bundled lexicon, shown in the UI footer. */
export async function getLexiconStats() {
  const lexicon = await loadLexicon();
  return { ...lexicon.stats, generatedAt: lexicon.generatedAt };
}
