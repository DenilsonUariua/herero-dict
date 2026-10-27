/**
 * Very small language hint for the translate box.
 *
 * Otjiherero and English are easy to tell apart without a model: English is
 * full of high-frequency function words, Otjiherero leans on noun-class
 * prefixes (otji-, oma-, oku-, omu-, ova-, ondj-) and concord particles
 * (wa, va, ve, ku, tji). This only ever produces a *suggestion* — the reader
 * stays in control of the direction.
 */

const ENGLISH_STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'am',
  'of', 'to', 'in', 'on', 'at', 'for', 'with', 'and', 'or', 'but',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her',
  'this', 'that', 'these', 'those', 'what', 'where', 'when', 'why', 'how',
  'do', 'does', 'did', 'have', 'has', 'had', 'will', 'would', 'can', 'not',
  'from', 'by', 'as', 'there', 'here', 'all', 'some', 'no', 'yes',
]);

// Long enough to be distinctive; short truncations like "ok"/"om" match too
// many English words ("okay", "overall") to be worth the false positives.
const HERERO_PREFIXES = [
  'otji', 'oma', 'oku', 'omu', 'ova', 'ondj', 'ondu', 'otja',
  'oru', 'oka', 'ou',
];

const HERERO_PARTICLES = new Set([
  'wa', 'va', 've', 'ku', 'tji', 'ndi', 'ngu', 'po', 'pi', 'ri', 'ra',
  'nawa', 'tjiri', 'rune', 'ne', 'kwa', 'ma', 'me', 'tu', 'mu', 'ahe',
]);

export type LanguageHint = 'en' | 'hz' | null;

export function detectLanguageHint(text: string): LanguageHint {
  const clean = (text ?? '')
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, ' ')
    .trim();
  if (!clean || clean.length < 3) return null;

  const words = clean.split(/\s+/).filter(Boolean);
  if (!words.length) return null;

  let english = 0;
  let herero = 0;

  for (const word of words) {
    if (ENGLISH_STOPWORDS.has(word)) english += 1;
    if (HERERO_PARTICLES.has(word)) herero += 1;
    if (HERERO_PREFIXES.some((prefix) => word.length > prefix.length + 1 && word.startsWith(prefix))) {
      herero += 1;
    }
  }

  // a single word is too ambiguous to judge
  if (words.length === 1 && english + herero < 1) return null;

  // Otjiherero markers and no English function words at all: confident enough
  if (herero >= 1 && english === 0 && words.length >= 2) return 'hz';
  if (herero >= 2 && herero > english) return 'hz';
  if (english >= 1 && english > herero) return 'en';
  return null;
}
