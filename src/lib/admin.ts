import { Query, Permission, Role, ID, type Models } from 'appwrite';
import { tables } from '@/lib/appwrite';
import { envConfigs } from '@/configs/env-configs';
import type { WordSuggestion, WordCorrection, Language, DictionaryWord } from '@/lib/dictionary';

const DB = envConfigs.appwriteDatabaseId;
export const POS_OPTIONS = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'interjection', 'phrase', 'other'];

export type WordStatus = 'approved' | 'pending' | 'archived';

export interface AdminWord extends Models.Row {
  languageId: string;
  word: string;
  pronunciation?: string;
  definitions?: string[];
  example?: string;
  partOfSpeech?: string;
  status: WordStatus;
  likes?: number;
  createdBy?: string;
}

export interface DraftEntry {
  herero: string;
  hereroPronunciation?: string;
  english: string;
  englishDefinition?: string;
  example?: string;
  partOfSpeech?: string;
}

export interface WordDraft extends Models.Row {
  sourceType: 'image' | 'pdf' | 'text';
  sourceName?: string;
  model?: string;
  entriesJson: string;
  rawPreview?: string;
  entryCount?: number;
  status: 'pending' | 'approved' | 'discarded';
  approvedWordIds?: string[];
  error?: string;
  createdBy?: string;
}

export interface MessageRow extends Models.Row {
  name?: string;
  text: string;
  userId?: string;
  isRead?: boolean;
}

// ---------------------------------------------------------------- admin check
export function isAdmin(user: { labels?: string[] } | null | undefined): boolean {
  return !!user?.labels?.includes('admin');
}

// ---------------------------------------------------------------- app settings
export async function getSetting(key: string): Promise<string | null> {
  try {
    const row = await tables.getRow<{ value: string } & Models.Row>(DB, envConfigs.appwriteSettingsTableId, key);
    return row.value || null;
  } catch {
    return null;
  }
}

export async function saveSetting(key: string, value: string, updatedBy?: string): Promise<void> {
  await tables.upsertRow(DB, envConfigs.appwriteSettingsTableId, key, { key, value, updatedBy });
}

// ---------------------------------------------------------------- words CRUD
export async function listWords(search: string, limit = 50): Promise<AdminWord[]> {
  const queries = [Query.limit(limit)];
  if (search.trim()) queries.push(Query.search('word', search.trim()));
  else queries.push(Query.orderDesc('$createdAt'));
  const res = await tables.listRows<AdminWord>(DB, envConfigs.appwriteCollectionId, queries);
  return res.rows;
}

export interface WordInput {
  languageId: string;
  word: string;
  pronunciation?: string;
  definitions?: string[];
  example?: string;
  partOfSpeech?: string;
  status?: WordStatus;
}

export async function createWord(input: WordInput): Promise<AdminWord> {
  return tables.createRow<AdminWord>(DB, envConfigs.appwriteCollectionId, ID.unique(), {
    likes: 0,
    status: 'approved',
    ...input,
  });
}

export async function updateWord(id: string, input: Partial<WordInput>): Promise<AdminWord> {
  return tables.updateRow<AdminWord>(DB, envConfigs.appwriteCollectionId, id, input);
}

export async function deleteWord(id: string): Promise<void> {
  // also remove translation rows pointing at this word
  try {
    const links = await tables.listRows(DB, envConfigs.appwriteTranslationsTableId, [Query.equal('wordId', id), Query.limit(100)]);
    for (const link of links.rows) {
      await tables.deleteRow(DB, envConfigs.appwriteTranslationsTableId, link.$id);
    }
  } catch { /* best effort */ }
  await tables.deleteRow(DB, envConfigs.appwriteCollectionId, id);
}

// ---------------------------------------------------------------- translations
async function findWord(languageId: string, word: string): Promise<AdminWord | null> {
  const res = await tables.listRows<AdminWord>(DB, envConfigs.appwriteCollectionId, [
    Query.equal('languageId', languageId),
    Query.equal('word', word),
    Query.limit(1),
  ]);
  return res.rows[0] ?? null;
}

async function linkTranslation(wordId: string, targetLanguageId: string, translation: string): Promise<void> {
  const existing = await tables.listRows(DB, envConfigs.appwriteTranslationsTableId, [
    Query.equal('wordId', wordId),
    Query.equal('languageId', targetLanguageId),
    Query.equal('translation', translation),
    Query.limit(1),
  ]);
  if (existing.rows.length) return;
  await tables.createRow(DB, envConfigs.appwriteTranslationsTableId, ID.unique(), {
    wordId,
    languageId: targetLanguageId,
    translation,
    isPrimary: true,
  });
}

// ---------------------------------------------------------------- suggestions moderation
export async function listSuggestions(status: string): Promise<WordSuggestion[]> {
  const queries = [Query.limit(100)];
  if (status !== 'all') queries.push(Query.equal('status', status));
  const res = await tables.listRows<WordSuggestion>(DB, envConfigs.appwriteSuggestionsTableId, queries);
  return res.rows;
}

export async function promoteSuggestion(s: WordSuggestion): Promise<string> {
  const word = await createWord({
    languageId: s.languageId,
    word: s.word,
    pronunciation: s.pronunciation || undefined,
    definitions: s.definitions?.length ? s.definitions : undefined,
    example: s.example || undefined,
    partOfSpeech: s.partOfSpeech || undefined,
    status: 'approved',
  });
  if (s.translation) {
    const target = s.languageId === 'en' ? 'hz' : 'en';
    await linkTranslation(word.$id, target, s.translation);
  }
  await tables.updateRow(DB, envConfigs.appwriteSuggestionsTableId, s.$id, {
    status: 'approved',
    reviewedAt: new Date().toISOString(),
    createdWordId: word.$id,
  });
  return word.$id;
}

export async function rejectSuggestion(id: string, reviewNote: string): Promise<void> {
  await tables.updateRow(DB, envConfigs.appwriteSuggestionsTableId, id, {
    status: 'rejected',
    reviewedAt: new Date().toISOString(),
    reviewNote: reviewNote || undefined,
  });
}

// ---------------------------------------------------------------- corrections moderation
export async function listCorrections(status: string): Promise<WordCorrection[]> {
  const queries = [Query.limit(100)];
  if (status !== 'all') queries.push(Query.equal('status', status));
  const res = await tables.listRows<WordCorrection>(DB, envConfigs.appwriteCorrectionsTableId, queries);
  return res.rows;
}

export async function applyCorrection(c: WordCorrection): Promise<void> {
  if (c.field === 'translation') {
    const word = await tables.getRow<AdminWord>(DB, envConfigs.appwriteCollectionId, c.wordId);
    const target = word.languageId === 'en' ? 'hz' : 'en';
    await linkTranslation(c.wordId, target, c.suggestedValue);
  } else {
    const data: Record<string, unknown> = {};
    if (c.field === 'definitions') data.definitions = c.suggestedValue.split('\n').map((d) => d.trim()).filter(Boolean);
    else if (c.field === 'word' || c.field === 'pronunciation' || c.field === 'example') data[c.field] = c.suggestedValue;
    else if (c.field === 'partOfSpeech') {
      if (!POS_OPTIONS.includes(c.suggestedValue)) throw new Error(`"${c.suggestedValue}" is not a valid part of speech (${POS_OPTIONS.join(', ')})`);
      data.partOfSpeech = c.suggestedValue;
    }
    if (Object.keys(data).length) await tables.updateRow(DB, envConfigs.appwriteCollectionId, c.wordId, data);
  }
  await tables.updateRow(DB, envConfigs.appwriteCorrectionsTableId, c.$id, {
    status: 'approved',
    reviewedAt: new Date().toISOString(),
  });
}

export async function rejectCorrection(id: string, reviewNote: string): Promise<void> {
  await tables.updateRow(DB, envConfigs.appwriteCorrectionsTableId, id, {
    status: 'rejected',
    reviewedAt: new Date().toISOString(),
    reviewNote: reviewNote || undefined,
  });
}

// ---------------------------------------------------------------- drafts
export async function listDrafts(): Promise<WordDraft[]> {
  const res = await tables.listRows<WordDraft>(DB, envConfigs.appwriteDraftsTableId, [Query.limit(100)]);
  return res.rows.sort((a, b) => (b.$createdAt ?? '').localeCompare(a.$createdAt ?? ''));
}

export async function saveDraft(d: {
  sourceType: WordDraft['sourceType'];
  sourceName?: string;
  model?: string;
  entries: DraftEntry[];
  rawPreview?: string;
  error?: string;
  createdBy?: string;
}): Promise<WordDraft> {
  return tables.createRow<WordDraft>(DB, envConfigs.appwriteDraftsTableId, ID.unique(), {
    sourceType: d.sourceType,
    sourceName: d.sourceName || undefined,
    model: d.model || undefined,
    entriesJson: JSON.stringify(d.entries),
    rawPreview: d.rawPreview?.slice(0, 4000) || undefined,
    entryCount: d.entries.length,
    status: 'pending',
    error: d.error || undefined,
    createdBy: d.createdBy || undefined,
  });
}

export async function discardDraft(id: string): Promise<void> {
  await tables.updateRow(DB, envConfigs.appwriteDraftsTableId, id, { status: 'discarded' });
}

/** Approve selected entries: creates Herero + English entries and links translations. Idempotent per entry. */
export async function approveDraftEntries(draft: WordDraft, selected: DraftEntry[]): Promise<{ created: number; linked: number }> {
  let created = 0;
  let linked = 0;
  const wordIds: string[] = [];

  for (const e of selected) {
    const herero = e.herero.trim();
    const english = e.english.trim();
    if (!herero || !english) continue;

    let hz = await findWord('hz', herero);
    if (!hz) {
      hz = await createWord({
        languageId: 'hz',
        word: herero,
        pronunciation: e.hereroPronunciation || undefined,
        definitions: e.englishDefinition ? [e.englishDefinition] : undefined,
        example: e.example || undefined,
        partOfSpeech: e.partOfSpeech && POS_OPTIONS.includes(e.partOfSpeech) ? e.partOfSpeech : undefined,
        status: 'approved',
      });
      created++;
    } else {
      linked++;
    }
    wordIds.push(hz.$id);

    let en = await findWord('en', english);
    if (!en) {
      en = await createWord({
        languageId: 'en',
        word: english,
        definitions: e.englishDefinition ? [e.englishDefinition] : undefined,
        partOfSpeech: e.partOfSpeech && POS_OPTIONS.includes(e.partOfSpeech) ? e.partOfSpeech : undefined,
        status: 'approved',
      });
      created++;
    } else {
      linked++;
    }
    wordIds.push(en.$id);

    await linkTranslation(hz.$id, 'en', english);
    await linkTranslation(en.$id, 'hz', herero);
  }

  await tables.updateRow(DB, envConfigs.appwriteDraftsTableId, draft.$id, {
    status: 'approved',
    approvedWordIds: wordIds,
  });
  return { created, linked };
}

// ---------------------------------------------------------------- word of the day
export interface WotdEntry extends Models.Row {
  date: string;
  wordId: string;
  word?: string;
  languageId?: string;
  note?: string;
}

export async function listWotd(): Promise<WotdEntry[]> {
  const res = await tables.listRows<WotdEntry>(DB, envConfigs.appwriteWotdTableId, [Query.limit(60)]);
  return res.rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export async function setWotd(date: string, wordId: string, languageId?: string, note?: string, word?: string): Promise<void> {
  await tables.upsertRow(DB, envConfigs.appwriteWotdTableId, date, { date, wordId, word: word || undefined, languageId, note: note || undefined });
}

export async function deleteWotd(date: string): Promise<void> {
  await tables.deleteRow(DB, envConfigs.appwriteWotdTableId, date);
}

// ---------------------------------------------------------------- messages
export async function listMessages(): Promise<MessageRow[]> {
  try {
    const res = await tables.listRows<MessageRow>(DB, envConfigs.appwriteMessagesTableId, [Query.orderDesc('$createdAt'), Query.limit(100)]);
    return res.rows;
  } catch {
    const res = await tables.listRows<MessageRow>(DB, envConfigs.appwriteMessagesTableId, [Query.limit(100)]);
    return res.rows;
  }
}

export async function setMessageRead(id: string, isRead: boolean): Promise<void> {
  await tables.updateRow(DB, envConfigs.appwriteMessagesTableId, id, { isRead });
}

export async function deleteMessage(id: string): Promise<void> {
  await tables.deleteRow(DB, envConfigs.appwriteMessagesTableId, id);
}

// ---------------------------------------------------------------- languages (for selects)
export async function listAllLanguages(): Promise<Language[]> {
  const res = await tables.listRows<Language>(DB, envConfigs.appwriteLanguagesTableId, [Query.limit(50)]);
  return res.rows;
}

// ---------------------------------------------------------------- Gemini extraction
export interface ExtractParams {
  apiKey: string;
  model?: string;
  sourceType: WordDraft['sourceType'];
  mimeType?: string; // image/png, application/pdf...
  base64Data?: string; // for image/pdf
  text?: string; // for text
}

const GEMINI_SCHEMA = {
  type: 'OBJECT',
  properties: {
    entries: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          herero: { type: 'STRING', description: 'Otjiherero headword, normalized' },
          hereroPronunciation: { type: 'STRING', description: 'pronunciation if present, e.g. /o-tu-mbe/' },
          english: { type: 'STRING', description: 'English equivalent or gloss' },
          englishDefinition: { type: 'STRING', description: 'short English definition if present' },
          example: { type: 'STRING', description: 'example sentence in Otjiherero if present' },
          partOfSpeech: { type: 'STRING', enum: POS_OPTIONS },
        },
        required: ['herero', 'english'],
      },
    },
  },
  required: ['entries'],
};

function buildExtractionPrompt(extra?: string): string {
  return [
    'You are a lexicographer building an Otjiherero <-> English dictionary.',
    'Extract every Herero-English word pair you can find in the provided content.',
    'Rules:',
    '- "herero": the Otjiherero headword (keep diacritics; trim list markers, numbering, slashes).',
    '- "english": the English equivalent or shortest gloss.',
    '- "hereroPronunciation": pronunciation if shown (often between slashes).',
    '- "englishDefinition": a short English definition if the content provides one.',
    '- "example": an Otjiherero example sentence if present (with its English if adjacent).',
    '- "partOfSpeech": classify if determinable, otherwise "other".',
    '- Skip headers, page numbers, non-word noise. Skip entries where either side is missing.',
    extra ? `- Additional context from the administrator: ${extra}` : '',
    'Return the entries array. If nothing useful is found, return an empty array.',
  ].filter(Boolean).join('\n');
}

export async function extractWithGemini(params: ExtractParams): Promise<{ entries: DraftEntry[]; model: string }> {
  const model = params.model || 'gemini-2.0-flash';
  const parts: Record<string, unknown>[] = [{ text: buildExtractionPrompt() }];

  if (params.sourceType === 'text') {
    parts.push({ text: params.text ?? '' });
  } else {
    if (!params.base64Data || !params.mimeType) throw new Error('Missing file content.');
    parts.push({ inline_data: { mime_type: params.mimeType, data: params.base64Data } });
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': params.apiKey },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: GEMINI_SCHEMA,
        },
      }),
    },
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Gemini request failed (${res.status})`);
  }
  const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  if (!text) throw new Error('Gemini returned no content — the file may be unreadable or empty.');

  let parsed: { entries?: DraftEntry[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Could not parse Gemini output as JSON.');
  }
  const entries = (parsed.entries ?? [])
    .filter((e) => e && typeof e.herero === 'string' && typeof e.english === 'string' && e.herero.trim() && e.english.trim())
    .map((e) => ({
      herero: e.herero.trim(),
      hereroPronunciation: e.hereroPronunciation?.trim() || undefined,
      english: e.english.trim(),
      englishDefinition: e.englishDefinition?.trim() || undefined,
      example: e.example?.trim() || undefined,
      partOfSpeech: e.partOfSpeech && POS_OPTIONS.includes(e.partOfSpeech) ? e.partOfSpeech : 'other',
    }));
  return { entries, model };
}

/** Simple connectivity test for the Settings tab. */
export async function testGeminiKey(apiKey: string, model?: string): Promise<string[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?pageSize=50`,
    { headers: { 'x-goog-api-key': apiKey } },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Gemini check failed (${res.status})`);
  const names: string[] = (data.models ?? []).map((m: { name: string }) => m.name.replace('models/', ''));
  const wanted = model || 'gemini-2.0-flash';
  if (!names.some((n) => n.startsWith(wanted))) {
    throw new Error(`Key works, but model "${wanted}" was not found for this key. Available include: ${names.slice(0, 6).join(', ')}...`);
  }
  return names;
}

export type { DictionaryWord };
