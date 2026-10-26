/**
 * Live dictionary fusion.
 *
 * The bundled lexicon is a build-time snapshot. New words approved through the
 * admin panel would otherwise be invisible to the translator until someone
 * re-runs `npm run build:lexicon`. This module queries the Appwrite `words`
 * table with its existing full-text indexes and turns hits into extra context
 * blocks, so the retriever keeps improving as the dictionary grows.
 *
 * Entirely best-effort: any failure (offline, permissions, missing index)
 * returns an empty list and the pipeline continues with the static lexicon.
 */

import { Query, type Models } from 'appwrite';
import { tables } from '@/lib/appwrite';
import { envConfigs } from '@/configs/env-configs';
import type { ContextBlock } from './types';

/** Tidy the scraped pronunciation field into something a model can read. */
function tidyHerero(raw: string): string {
  return String(raw ?? '')
    .replace(/^[\s/–—-]+/, '')
    .replace(/[\s.]+$/, '')
    .trim();
}

interface LiveWordRow extends Models.Row {
  word?: string;
  pronunciation?: string;
  definitions?: string[];
  languageId?: string;
}

export async function fetchLiveBlocks(
  contentWords: string[],
  options: { limit?: number; signal?: AbortSignal } = {},
): Promise<ContextBlock[]> {
  const { limit = 6, signal } = options;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) return [];
  if (!envConfigs.appwriteDatabaseId || !envConfigs.appwriteCollectionId) return [];

  // full-text search needs reasonably sized terms; keep the most specific ones
  const terms = [...new Set(contentWords.filter((w) => w.length >= 3))]
    .sort((a, b) => b.length - a.length)
    .slice(0, 4);

  if (!terms.length) return [];

  try {
    const res = await tables.listRows<LiveWordRow>(
      envConfigs.appwriteDatabaseId,
      envConfigs.appwriteCollectionId,
      [
        Query.equal('status', 'approved'),
        Query.or(terms.flatMap((t) => [Query.search('word', t), Query.search('pronunciation', t)])),
        Query.limit(limit),
      ],
    );

    if (signal?.aborted) return [];

    return res.rows
      .filter((row) => row.word)
      .map((row) => ({
        id: row.$id,
        en: String(row.word ?? '').toUpperCase(),
        qualifier: null,
        hz: row.pronunciation ? [tidyHerero(row.pronunciation)] : [],
        examples: (row.definitions ?? [])
          .filter(Boolean)
          .slice(0, 1)
          .map((d) => ({ en: null, hz: String(d) })),
        matched: [],
        score: 0,
        source: 'live' as const,
      }));
  } catch (err) {
    console.warn('[rag] live dictionary lookup skipped:', err);
    return [];
  }
}
