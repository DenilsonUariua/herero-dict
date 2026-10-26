/**
 * Prompt construction for grounded Otjiherero generation.
 *
 * The model has essentially no Otjiherero training data, so everything it
 * knows about the language has to come from this prompt:
 *   1. a compact grammar reference (noun classes, concords, tense, negation)
 *   2. few-shot pairs lifted from the dictionary's own example sentences
 *   3. the retrieved lexicon entries for THIS sentence
 *   4. an explicit instruction to flag anything not covered
 *
 * The grammar block below is derived from constructions attested in the
 * dictionary corpus itself (e.g. "Ma ungura", "Omuatje wa ningena",
 * "U ri nawa"), so it stays consistent with the reference the app ships.
 */

import type { ContextBlock, Direction } from './types';

export const OUTPUT_SCHEMA_DOC = `{
  "herero": "the Otjiherero text — your translation when going EN->HZ, or the input when going HZ->EN",
  "english": "the English text — your translation when going HZ->EN, otherwise a faithful back-translation",
  "gloss": [{"en": "one English chunk", "hz": "the Otjiherero chunk that expresses it"}],
  "notes": "1-3 sentences on grammar choices, or on what you could not express",
  "confidence": 0.0,
  "usedEntries": ["HEADWORD", "..."],
  "uncovered": ["english", "words", "with", "no", "dictionary", "support"]
}`;

const GRAMMAR_REFERENCE = `OTJIHERERO (Herero) ESSENTIALS

Noun classes — the prefix on the noun controls agreement on verbs, adjectives
and possessives. Class pairs (singular/plural):
  cl1 omu-   / cl2 ova-      people            omundu / ovandu
  cl3 omu-   / cl4 omi-      trees, non-persons omuti / omiti
  cl5 e-, o- / cl6 oma-      liquids, plurals  eyo / omayo
  cl7 otji-  / cl8 ovi-      things, diminutive otjivike / ovivike
  cl9 o-, e- / cl10 ozo-     animals, loanwords ongombe / ozongombe
  cl11 oru-  / cl13 otu-     long/thin things  oruiho / otuiho
  cl12 oka-  / cl14 ou-      small / abstract   okazona / ouzona
  cl15 oku-                  infinitives        okuhupura (to dig)
  cl16-18 mo-, ku-, po-      locatives          mombapaiziro (in the wink)

Subject concords, present tense:
  1sg me- / 2sg u- / 1pl tu- / 2pl mu-
  cl1 ma-   cl2 va-   cl3 u-   cl4 i-   cl5 li-  cl6 a-
  cl7 tji-  cl8 vi-   cl9 i-  cl10 ze-  cl11 ru- cl14 u-  cl15 ku-

Perfect / recent past: subject concord + -a- then the verb ending in -a
  Omuatje wa ningena.        The child is wet.
  Omboha ya kurunga.         The screw is worn out.
  Ovandu avehe va pondoka.   All the people have been wiped out.

Future / intent: me- (1sg), ma- (cl1) + verb
  Me ku kumisa.              I will make you wonder.

Infinitive: oku- + verb stem
  Okuhupura ondjombo.        To dig a well.

Imperative: bare verb stem
  Pora ovinanyiva.           Weed the garden.
  Kama erapi rokukoha.       Wring out the dish-cloth.

Copula and possession:
  U ri nawa.                 You are well.        (ri = to be)
  kara na ...                to be with / to have

Locatives: mo- (inside), ku- (at/to), po- (on) attach to the noun
  mombapaiziro yeho          in the wink of an eye
  komuhingo                  in a manner / way

Questions: keep the word order, add the question word
  U tura pi?                 Where do you stay?
  Omundu me ya rune?         When is the man coming?

Agreement is not optional: pick the noun class of the subject and use its
concord on the verb. When the reference above does not cover a construction,
prefer the pattern of the closest example in the RETRIEVED ENTRIES and say so
in "notes".`;

const FEW_SHOT = `EXAMPLES OF THE TASK

Input: He works in a marvellous way.
Output: {"herero":"Ma ungura komuhingo omukumise.","english":"He works in a marvellous way.","gloss":[{"en":"he","hz":"ma"},{"en":"works","hz":"ungura"},{"en":"in a way","hz":"komuhingo"},{"en":"marvellous","hz":"omukumise"}],"notes":"ma- is the class 1 subject concord; komuhingo is the locative of omuhingo (manner).","confidence":0.8,"usedEntries":["WAY"],"uncovered":["marvellous"]}

Input: Where do you stay?
Output: {"herero":"U tura pi?","english":"Where do you stay?","gloss":[{"en":"you","hz":"u"},{"en":"stay","hz":"tura"},{"en":"where","hz":"pi"}],"notes":"pi is the interrogative placed sentence-finally.","confidence":0.85,"usedEntries":["WHERE?"],"uncovered":[]}

Input: The child is wet.
Output: {"herero":"Omuatje wa ningena.","english":"The child is wet.","gloss":[{"en":"the child","hz":"omuatje"},{"en":"is wet","hz":"wa ningena"}],"notes":"omuatje is class 1, so the perfect concord is wa-.","confidence":0.9,"usedEntries":["WET"],"uncovered":[]}`;

function renderBlock(block: ContextBlock, index: number): string {
  const lines: string[] = [];
  const label = block.qualifier ? `${block.en} (${block.qualifier})` : block.en;
  lines.push(`${index + 1}. ${label}`);
  if (block.hz.length) lines.push(`   Otjiherero: ${block.hz.join('; ')}`);
  for (const ex of block.examples.slice(0, 2)) {
    if (ex.en) lines.push(`   Example: "${ex.en}" -> "${ex.hz}"`);
    else lines.push(`   Usage: "${ex.hz}"`);
  }
  return lines.join('\n');
}

export interface BuildMessagesArgs {
  text: string;
  direction: Direction;
  blocks: ContextBlock[];
  uncovered: string[];
}

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

export function buildMessages({ text, direction, blocks, uncovered }: BuildMessagesArgs): ChatMessage[] {
  const toHerero = direction === 'en-hz';

  const system = `You are a careful Otjiherero (Herero) translator and language teacher working inside a community dictionary app.

You translate ${toHerero ? 'English into Otjiherero' : 'Otjiherero into English'}.

${GRAMMAR_REFERENCE}

${FEW_SHOT}

HARD RULES
- Use ONLY vocabulary that appears in the RETRIEVED ENTRIES, or that is built from
  them by regular morphology described above. Do not invent words.
- Never silently drop a content word. If the dictionary has no entry for it, use
  the closest attested term, list the original word in "uncovered", and mention
  the substitution in "notes".
- Keep sentences short and grammatical rather than long and approximate.
- Always fill BOTH "herero" and "english": one is your translation, the other is
  the source-side text (normalised, or back-translated for checking).
- Set "confidence" honestly: 0.85+ only when every content word is attested and
  the construction follows an example; 0.5-0.7 when some words are substituted;
  below 0.4 when you are extrapolating.
- Reply with a single JSON object and nothing else. No markdown, no code fences.

JSON SHAPE
${OUTPUT_SCHEMA_DOC}`;

  const context = blocks.length
    ? blocks.map(renderBlock).join('\n')
    : '(the retriever found no matching dictionary entries)';

  const user = `RETRIEVED ENTRIES (from the Otjiherero dictionary)
${context}

${uncovered.length ? `CONTENT WORDS WITH NO DICTIONARY ENTRY: ${uncovered.join(', ')}\n\n` : ''}${
    toHerero ? 'TRANSLATE THIS ENGLISH SENTENCE INTO OTJIHERERO' : 'TRANSLATE THIS OTJIHERERO SENTENCE INTO ENGLISH'
  }
"${text}"

Return the JSON object only.`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
