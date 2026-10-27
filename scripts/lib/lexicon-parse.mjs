/**
 * lexicon-parse.mjs
 * ------------------------------------------------------------------
 * Turns the raw scraped/OCR'd dictionary rows (words.json) into clean,
 * structured lexicon entries that both the app and the RAG retriever
 * can reason about.
 *
 * Raw row shape:
 *   { word, pronunciation, definitions, dateAdded, lastModified, likes }
 *
 * Raw conventions found in the source data:
 *   word           "WAY", "WHEEL: STEERING", "WHO?"
 *   pronunciation  "/komuhingo."  "/tukara, sononoka."  "/otjingundi (ovi-)."
 *                  "-/nongapara."  "/-kuhe."
 *   definitions    "HE WORKS IN A MARVELLOUS WAY/Ma ungura komuhingo omukumise."
 *                  "STORM-/otjivepo (ovi-). WHIRL-/orukumbambura (otu-)."
 *                  "(TABLE)/yeka. - OUT/zemisa."
 *
 * i.e. "/" separates English from Herero, and "(ovi-)" is the plural
 * noun-class prefix. The data is machine-dirty (stray hyphens, OCR'd
 * digits such as "o20-1", unterminated parens), so every extractor
 * here is defensive and records `flags` instead of throwing.
 * ------------------------------------------------------------------
 */

/** Strip leading separators and trailing punctuation from a fragment. */
function cleanFragment(s) {
  return String(s ?? '')
    .replace(/^[\s/–—-]+/, '')
    .replace(/[\s/.,;:–—-]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pull a trailing annotation out of a Herero term.
 *
 *   "(ovi-)"  -> plural/singular noun-class marker   (2+ letters, usually hyphenated)
 *   "(e)"     -> verb ending variant, NOT a class marker
 *   "(o20-1"  -> OCR damage, keep the letters, flag it
 *
 * Returns { text, classPrefix, verbEnding, broken }.
 */
function extractClassPrefix(token) {
  let text = String(token ?? '').trim();
  let classPrefix = null;
  let verbEnding = null;
  let broken = false;

  // drop the sentence-final period first, otherwise "(ovi-)." never matches
  text = text.replace(/[\s.,;:]+$/, '');

  // last parenthesised group, possibly unterminated
  const m = text.match(/\(([^)]*)\)?\s*$/);
  if (m) {
    const inner = m[1].trim();
    const hyphenated = /-\s*\d*$/.test(inner);
    const lettersOnly = /^[a-z]+\s*-?\s*\d*$/i.test(inner);

    if (lettersOnly) {
      const letters = inner.replace(/[^a-z]/gi, '').toLowerCase();
      // single bare letter ("(e)", "(i)") is a verb-ending variant
      if (letters.length === 1 && !hyphenated) {
        verbEnding = letters;
      } else if (letters.length >= 2) {
        classPrefix = letters;
      }
      if (/\d/.test(inner)) broken = true; // "o20-1", "ova-1", "00-1"
    } else if (/\d/.test(inner)) {
      broken = true;
    }
    text = text.slice(0, m.index).trim();
  }

  // leftover stray parens / hyphens
  if (/[()]/.test(text)) broken = true;
  text = cleanFragment(text);

  return { text, classPrefix, verbEnding, broken };
}

/** True when a token looks like an Otjiherero word rather than an English label. */
function looksHerero(token) {
  const t = cleanFragment(token);
  if (!t) return false;
  if (!/[a-z]/.test(t)) return false; // ALL-CAPS only => English label
  // English labels that survived the caps test ("omuhongo-none") are rare;
  // Herero rarely has "the/is/and" style words.
  return !/\b(the|is|are|of|to|and|you|he|she|it)\b/i.test(t);
}

/**
 * Extract Herero terms from the `pronunciation` field.
 *
 *   "/tukara, sononoka."                -> [tukara, sononoka]
 *   "/omukazendu (ova-)."               -> [{ hz: 'omukazendu', classPrefix: 'ova' }]
 *   "ACCORDING TO THE /komuhingo."      -> cue "ACCORDING TO THE" + [komuhingo]
 *   "(AT THE BRIDEGROOM'S HOUSE)/ondjova (ozo-)"
 */
function parseTerms(pronunciation) {
  const raw = String(pronunciation ?? '').trim();
  const terms = [];
  const flags = [];
  let cue = null;

  // Some rows put an English cue before the "/" ("ACCORDING TO THE /komuhingo")
  let body = raw;
  const slash = raw.indexOf('/');
  if (slash > 0) {
    const head = cleanFragment(raw.slice(0, slash));
    if (head) cue = head.replace(/^\(|\)$/g, '').trim() || null;
    body = raw.slice(slash + 1);
  }

  // split on commas / semicolons, but never inside parentheses
  const parts = [];
  let depth = 0;
  let buf = '';
  for (const ch of body) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if ((ch === ',' || ch === ';') && depth === 0) {
      parts.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  parts.push(buf);

  for (const part of parts) {
    // a bare "-" marks "no entry"
    if (!/[a-z]/i.test(part.replace(/\([^)]*\)?/g, ''))) continue;
    const { text, classPrefix, verbEnding, broken } = extractClassPrefix(part);
    if (!text || text === '-') continue;
    if (broken) flags.push('ocr-class-prefix');
    terms.push({
      hz: text,
      classPrefix: classPrefix ?? null,
      verbEnding: verbEnding ?? null,
      source: 'pronunciation',
    });
  }

  return { terms, flags, cue };
}

/**
 * Split a `definitions` blob into segments. Segments end at ". " when the
 * next chunk starts a new English label.
 */
function splitSegments(definitions) {
  return String(definitions ?? '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.:])\s+(?=[A-Z(–—-])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Parse the `definitions` blob into example sentences and sub-entries.
 * A pair whose Herero side is a full sentence (>= 3 words) or whose English
 * side is a parenthesised cue is an example; a short pair is a sub-entry
 * ("STORM-/otjivepo" => sub-lemma STORM).
 */
function parseDefinitions(definitions) {
  const examples = [];
  const subEntries = [];
  const terms = [];
  const flags = [];

  for (const segment of splitSegments(definitions)) {
    const slash = segment.indexOf('/');

    // No slash: a loose Herero fragment ("omuhongo-none.")
    if (slash === -1) {
      const frag = cleanFragment(segment);
      if (frag && looksHerero(frag)) {
        terms.push({ hz: frag, classPrefix: null, source: 'definitions' });
      }
      continue;
    }

    let en = segment.slice(0, slash).trim();
    let hz = segment.slice(slash + 1).trim();

    // strip the trailing period/colon that ended the segment
    hz = hz.replace(/[.:]+$/, '').trim();
    en = en.replace(/[.:]+$/, '').trim();

    if (!hz) continue;

    const isCue = /^\(/.test(en) || /:$/.test(segment.slice(0, slash + 1));
    const hzWords = hz.split(/\s+/).filter(Boolean);
    const isExample = isCue || hzWords.length >= 3;

    if (isExample) {
      examples.push({
        en: cleanFragment(en) || null,
        hz: cleanFragment(hz),
        // "(TABLE)/yeka" is a usage cue for the headword, not a sentence
        cue: isCue,
      });
      continue;
    }

    // sub-entry: "STORM-" / "OLD -" / "- AFTER GOING TO THE TOILET"
    const label = cleanFragment(en)
      .replace(/^OR\s+/i, '')
      .replace(/\s*-\s*$/, '')
      .trim();
    const { text, classPrefix, broken } = extractClassPrefix(hz);
    if (broken) flags.push('ocr-class-prefix');
    if (!text) continue;

    if (label) {
      subEntries.push({ en: label.toUpperCase(), hz: text, classPrefix: classPrefix ?? null });
    } else {
      terms.push({ hz: text, classPrefix: classPrefix ?? null, source: 'definitions' });
    }
  }

  return { examples, subEntries, terms, flags };
}

/** "WHEEL: STEERING" -> { lemma: 'WHEEL', qualifier: 'STEERING' } */
function splitHeadword(word) {
  const raw = String(word ?? '').trim();
  const m = raw.match(/^([^:]+):\s*(.+)$/);
  if (!m) return { en: raw, lemma: raw, qualifier: null };
  return { en: raw, lemma: m[1].trim(), qualifier: m[2].trim() };
}

/**
 * Phrases are whole sentences, not single lexical items: no comma splitting,
 * no noun-class extraction (a trailing "(plur.)" is a label, not a class),
 * and variants are separated by "·".
 * "/Wa penduka nawa? (sing.) · Mwa penduka nawa? (plur.)."
 *   -> ["Wa penduka nawa?", "Mwa penduka nawa?"]
 */
function parsePhraseTerms(pronunciation) {
  const raw = String(pronunciation ?? '')
    .trim()
    .replace(/^[\s/]+/, '')
    .replace(/[\s.]+$/, '');

  return raw
    .split('·')
    .map((variant) =>
      variant
        .replace(/\([^)]*\)/g, ' ') // drop (sing.) / (plur.) / (early evening) labels
        .replace(/\s+/g, ' ')
        .replace(/^[\s/–—-]+/, '')
        .replace(/[\s/.,;:–—-]+$/, '')
        .trim(),
    )
    .filter(Boolean)
    .map((hz) => ({ hz, classPrefix: null, verbEnding: null, source: 'pronunciation' }));
}

/** For phrases, each definitions string is exactly one "ENGLISH/Herero" pair. */
function parsePhraseExamples(definitions) {
  const list = Array.isArray(definitions) ? definitions : definitions ? [definitions] : [];
  const examples = [];
  for (const raw of list) {
    const text = String(raw ?? '').trim();
    if (!text) continue;
    const slash = text.indexOf('/');
    if (slash === -1) {
      examples.push({ en: null, hz: text, cue: false });
      continue;
    }
    examples.push({
      en: text.slice(0, slash).trim().replace(/[.:]+$/, '') || null,
      hz: text.slice(slash + 1).trim().replace(/[\s.]+$/, ''),
      cue: false,
    });
  }
  return examples;
}

/**
 * Parse one raw dictionary row into a structured entry.
 * @param {Record<string, unknown>} row
 * @param {string} id
 */
export function parseEntry(row, id) {
  const { en, lemma, qualifier } = splitHeadword(row?.word);
  const flags = new Set();

  // Whole-sentence entries (greetings, set phrases) take a simpler path.
  if (row?.partOfSpeech === 'phrase') {
    return {
      id,
      en,
      lemma,
      enNorm: lemma.toLowerCase(),
      qualifier,
      pronCue: null,
      terms: parsePhraseTerms(row?.pronunciation),
      subEntries: [],
      examples: parsePhraseExamples(row?.definitions),
      flags: [],
    };
  }

  const fromPronunciation = parseTerms(row?.pronunciation);
  fromPronunciation.flags.forEach((f) => flags.add(f));

  const fromDefinitions = parseDefinitions(row?.definitions);
  fromDefinitions.flags.forEach((f) => flags.add(f));

  if (/[\d]/.test(String(row?.sourceWord ?? en))) flags.add('ocr-headword');
  if (!fromPronunciation.terms.length && !fromDefinitions.terms.length && !fromDefinitions.subEntries.length) {
    flags.add('no-herero-term');
  }

  // de-duplicate terms by normalised Herero text
  const seen = new Set();
  const terms = [];
  for (const t of [...fromPronunciation.terms, ...fromDefinitions.terms]) {
    const key = t.hz.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    terms.push({
      hz: t.hz,
      classPrefix: t.classPrefix ?? null,
      verbEnding: t.verbEnding ?? null,
      source: t.source,
    });
  }

  return {
    id,
    en,
    lemma,
    enNorm: lemma.toLowerCase(),
    qualifier,
    pronCue: fromPronunciation.cue ?? null,
    terms,
    subEntries: fromDefinitions.subEntries,
    examples: fromDefinitions.examples,
    flags: [...flags],
  };
}

/** Normalise a Herero word for matching: lowercase, strip class-prefix punctuation. */
export function normHz(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-zà-ÿ]/g, '')
    .trim();
}

/** Normalise an English word for matching. */
export function normEn(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-zà-ÿ\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build the full lexicon document from raw rows.
 * @param {Array<Record<string, unknown>>} rows
 */
export function buildLexicon(rows) {
  const entries = [];
  const hzIndex = [];
  const seenWords = new Set();
  const senseCount = new Map();
  let counter = 0;

  for (const row of rows) {
    const rawWord = String(row?.word ?? '').trim();
    if (!rawWord) continue;

    // the old app de-duplicated repeated headwords with "-2" suffixes; keep that
    // behaviour so ids stay stable and every row survives.
    let en = rawWord;
    if (seenWords.has(en.toUpperCase())) {
      let n = 2;
      while (seenWords.has(`${en.toUpperCase()}-${n}`)) n++;
      en = `${en}-${n}`;
    }
    seenWords.add(en.toUpperCase());

    // homographs ("WHISTLE" x3) keep their own row but share a lemma + sense number
    const senseKey = rawWord.toUpperCase();
    const sense = (senseCount.get(senseKey) ?? 0) + 1;
    senseCount.set(senseKey, sense);

    counter += 1;
    const id = `w${String(counter).padStart(4, '0')}`;
    const entry = { ...parseEntry({ ...row, word: en, sourceWord: rawWord }, id), sense };
    entries.push(entry);

    for (const t of entry.terms) {
      hzIndex.push({ hz: t.hz, hzNorm: normHz(t.hz), en: entry.en, lemma: entry.lemma, entryId: id, kind: 'primary' });
    }
    for (const s of entry.subEntries) {
      hzIndex.push({ hz: s.hz, hzNorm: normHz(s.hz), en: s.en, lemma: s.en, entryId: id, kind: 'sub' });
    }
  }

  const exampleCount = entries.reduce((n, e) => n + e.examples.length, 0);
  const termCount = hzIndex.length;

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: 'words.json',
    stats: { entries: entries.length, terms: termCount, examples: exampleCount },
    entries,
    hzIndex,
  };
}
