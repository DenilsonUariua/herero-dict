import { Query, Permission, Role, ID, type Models } from 'appwrite';
import { tables } from '@/lib/appwrite';
import { envConfigs } from '@/configs/env-configs';
import type { Profile } from '@/lib/auth';

export interface Language extends Models.Row {
  code: string;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  isActive: boolean;
  sortOrder: number;
}

export interface WordSuggestion extends Models.Row {
  userId: string;
  userName: string;
  languageId: string;
  word: string;
  pronunciation?: string;
  definitions?: string[];
  example?: string;
  partOfSpeech?: string;
  translation?: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewNote?: string;
  reviewedAt?: string;
  createdWordId?: string;
}

export interface WordCorrection extends Models.Row {
  userId: string;
  userName?: string;
  wordId: string;
  word: string;
  field: 'word' | 'pronunciation' | 'definitions' | 'example' | 'partOfSpeech' | 'translation' | 'other';
  currentValue?: string;
  suggestedValue: string;
  note?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewNote?: string;
  reviewedAt?: string;
}

export interface DictionaryWord extends Models.Row {
  word: string;
  languageId: string;
  pronunciation?: string;
  definitions?: string[];
  status: string;
  likes?: number;
}

interface WotdRow extends Models.Row {
  wordId: string;
}

export interface WordLike extends Models.Row {
  userId: string;
  wordId: string;
  word: string;
}

// ------------------------------------------------------------ languages
export async function fetchLanguages(): Promise<Language[]> {
  const res = await tables.listRows<Language>(
    envConfigs.appwriteDatabaseId,
    envConfigs.appwriteLanguagesTableId,
    [Query.equal('isActive', true), Query.orderAsc('sortOrder')],
  );
  return res.rows;
}

// ------------------------------------------------------------ word of the day
function dayIndexUTC(): number {
  return Math.floor(Date.now() / 86400000);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function fetchWordOfTheDay(): Promise<DictionaryWord | null> {
  const db = envConfigs.appwriteDatabaseId;
  // 1. curated row for today, if the admin picked one
  try {
    const wotd = await tables.getRow<WotdRow>(envConfigs.appwriteDatabaseId, envConfigs.appwriteWotdTableId, todayISO());
    const word = await tables.getRow<DictionaryWord>(db, envConfigs.appwriteCollectionId, wotd.wordId);
    return word;
  } catch {
    /* no curated row — fall through to deterministic pick */
  }

  // 2. deterministic fallback: rotates through all approved words daily
  try {
    const totalRes = await tables.listRows(db, envConfigs.appwriteCollectionId, [
      Query.equal('status', 'approved'),
      Query.limit(1),
    ]);
    const total = totalRes.total;
    if (!total) return null;
    const offset = dayIndexUTC() % total;
    const res = await tables.listRows<DictionaryWord>(db, envConfigs.appwriteCollectionId, [
      Query.equal('status', 'approved'),
      Query.orderAsc('word'),
      Query.limit(1),
      Query.offset(offset),
    ]);
    return res.rows[0] ?? null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------ likes
export async function fetchLikeCount(wordId: string): Promise<number> {
  const res = await tables.listRows(
    envConfigs.appwriteDatabaseId,
    envConfigs.appwriteLikesTableId,
    [Query.equal('wordId', wordId), Query.limit(1)],
  );
  return res.total;
}

export async function fetchMyLikes(userId: string): Promise<WordLike[]> {
  const res = await tables.listRows<WordLike>(
    envConfigs.appwriteDatabaseId,
    envConfigs.appwriteLikesTableId,
    [Query.equal('userId', userId), Query.orderDesc('$createdAt'), Query.limit(200)],
  );
  return res.rows;
}

export async function likeWord(userId: string, wordId: string, word: string): Promise<void> {
  await tables.createRow(
    envConfigs.appwriteDatabaseId,
    envConfigs.appwriteLikesTableId,
    ID.unique(),
    { userId, wordId, word },
    [Permission.delete(Role.user(userId))],
  );
}

export async function unlikeWord(userId: string, wordId: string): Promise<void> {
  const res = await tables.listRows<WordLike>(
    envConfigs.appwriteDatabaseId,
    envConfigs.appwriteLikesTableId,
    [Query.equal('userId', userId), Query.equal('wordId', wordId), Query.limit(1)],
  );
  const row = res.rows[0];
  if (row) await tables.deleteRow(envConfigs.appwriteDatabaseId, envConfigs.appwriteLikesTableId, row.$id);
}

// ------------------------------------------------------------ suggestions
export interface SuggestionInput {
  languageId: string;
  word: string;
  pronunciation?: string;
  definitions?: string[];
  example?: string;
  partOfSpeech?: string;
  translation?: string;
  notes?: string;
}

export async function submitSuggestion(user: { $id: string; name?: string; profile?: Profile | null }, input: SuggestionInput): Promise<WordSuggestion> {
  const perms = [Permission.read(Role.user(user.$id)), Permission.delete(Role.user(user.$id))];
  return tables.createRow<WordSuggestion>(
    envConfigs.appwriteDatabaseId,
    envConfigs.appwriteSuggestionsTableId,
    ID.unique(),
    {
      userId: user.$id,
      userName: user.profile?.displayName || user.name || undefined,
      ...input,
      status: 'pending',
    },
    perms,
  );
}

export async function fetchMySuggestions(userId: string): Promise<WordSuggestion[]> {
  const res = await tables.listRows<WordSuggestion>(
    envConfigs.appwriteDatabaseId,
    envConfigs.appwriteSuggestionsTableId,
    [Query.equal('userId', userId), Query.orderDesc('$createdAt'), Query.limit(100)],
  );
  return res.rows;
}

// ------------------------------------------------------------ corrections
export interface CorrectionInput {
  wordId: string;
  word: string;
  field: WordCorrection['field'];
  currentValue?: string;
  suggestedValue: string;
  note?: string;
}

export async function submitCorrection(user: { $id: string; name?: string; profile?: Profile | null }, input: CorrectionInput): Promise<WordCorrection> {
  const perms = [Permission.read(Role.user(user.$id)), Permission.delete(Role.user(user.$id))];
  return tables.createRow<WordCorrection>(
    envConfigs.appwriteDatabaseId,
    envConfigs.appwriteCorrectionsTableId,
    ID.unique(),
    {
      userId: user.$id,
      userName: user.profile?.displayName || user.name || undefined,
      ...input,
      status: 'pending',
    },
    perms,
  );
}

export async function fetchMyCorrections(userId: string): Promise<WordCorrection[]> {
  const res = await tables.listRows<WordCorrection>(
    envConfigs.appwriteDatabaseId,
    envConfigs.appwriteCorrectionsTableId,
    [Query.equal('userId', userId), Query.orderDesc('$createdAt'), Query.limit(100)],
  );
  return res.rows;
}
