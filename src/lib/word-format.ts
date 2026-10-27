/**
 * Display formatting for dictionary rows.
 *
 * The source data comes from a scanned dictionary, so it carries OCR debris:
 * headwords are shouted in caps (`AARDVARK (AFRICAN ANT-BEAR)`) and the
 * Otjiherero column keeps its original `/…/` phonetics wrapper, trailing full
 * stops and a `(ozo-)` plural marker. Cleaning that up here keeps the cards
 * readable without touching the underlying records.
 */

export interface HereroTerm {
  /** The Otjiherero term without punctuation noise. */
  term: string;
  /** Plural class prefix, e.g. `ozo-`, when the source recorded one. */
  plural: string | null;
}

/** Split `/ondji-mbandjimba (ozo-).` into `ondji-mbandjimba` + `ozo-`. */
export function splitHerero(raw?: string | null): HereroTerm {
  const value = (raw ?? '').trim();
  if (!value || /^no translation/i.test(value)) return { term: '', plural: null };

  const pluralMatch = value.match(/\(([^)]*?)-\)/);
  const plural = pluralMatch ? pluralMatch[1].trim() : null;

  const term = value
    .replace(/^[\s/[]+/, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/[\s./]+$/, '')
    .trim();

  return { term, plural };
}

const SMALL_WORDS = new Set(['a', 'an', 'and', 'of', 'the', 'to', 'in', 'on', 'for', 'with']);

/**
 * Turn an all-caps headword into something readable, leaving mixed-case
 * entries (proper nouns, already-edited rows) untouched.
 */
export function displayHeadword(raw?: string | null): string {
  const value = (raw ?? '').replace(/-\s*\d+$/, '').trim();
  if (!value) return '';
  if (value !== value.toUpperCase()) return value;

  const lower = value.toLowerCase();
  return lower.replace(/[a-z]+/g, (word, offset: number) => {
    if (offset > 0 && SMALL_WORDS.has(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
}

/** First definition, trimmed, or null when the row has none worth showing. */
export function firstDefinition(definitions?: string[] | null): string | null {
  const value = (definitions ?? []).map((d) => (d ?? '').trim()).find((d) => d.length > 0);
  return value ?? null;
}

/**
 * The source stores example pairs as `ENGLISH/Otjiherero` with the English
 * half shouted. Sentence-case the English part, leave the Otjiherero part
 * alone (its casing is meaningful), and use a dash between the two.
 */
export function formatExample(raw?: string | null): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;

  const parts = value
    .split('/')
    .map((part) => sentenceCaseIfShouty(part.trim()))
    .filter(Boolean);

  if (!parts.length) return null;
  return parts.join(' — ');
}

function sentenceCaseIfShouty(value: string): string {
  if (!value) return value;
  if (/[a-z]/.test(value)) return value; // already has lower case — leave it alone
  const lower = value.toLowerCase();
  return lower.replace(/(^|[.!?]\s+)([a-z])/g, (_, prefix: string, letter: string) => prefix + letter.toUpperCase());
}
