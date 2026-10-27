import { envConfigs } from '@/configs/env-configs';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Query, type Models } from 'appwrite';
import { tables } from '@/lib/appwrite';

export interface Word extends Models.Row {
  word: string;
  languageId: string;
  pronunciation: string;
  definitions: string[];
  example?: string;
  partOfSpeech?: string;
  status: 'approved' | 'pending' | 'archived';
  dateAdded: string;
  lastModified: string;
  likes: number;
  originalWord?: string;
  modified?: boolean;
}

interface WordsResponse {
  documents: Word[];
  total: number;
}

interface UseFetchWordsParams {
  initialPage?: number;
  initialLimit?: number;
  initialSortBy?: 'word' | 'dateAdded' | 'likes';
  initialSortOrder?: 'asc' | 'desc';
}

interface CacheEntry {
  data: WordsResponse;
  timestamp: number;
}

interface CacheData {
  [key: string]: CacheEntry;
}

// A community dictionary changes when someone submits a correction, so a
// page of results is only trusted for a few minutes. The full word list is
// kept for a week because it exists for offline reading, not freshness.
const PAGE_CACHE_TTL = 10 * 60 * 1000;
const FULL_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const CACHE_KEY = 'words_cache';
const FULL_WORDS_CACHE_KEY = 'full_words_cache';
const PAGE_SIZE = 24;

const DATABASE_ID = envConfigs.appwriteDatabaseId;
const COLLECTION_ID = envConfigs.appwriteCollectionId;

export const useFetchWords = ({
  initialPage = 1,
  initialLimit = PAGE_SIZE,
  initialSortBy = 'word',
  initialSortOrder = 'asc',
}: UseFetchWordsParams = {}) => {
  const [words, setWords] = useState<Word[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [sortBy, setSortBy] = useState<'word' | 'dateAdded' | 'likes'>(initialSortBy);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialSortOrder);
  const [totalPages, setTotalPages] = useState(0);
  const [totalWords, setTotalWords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // keep the in-flight request identifiable so a slow first page cannot
  // overwrite the results of a newer search
  const requestId = useRef(0);

  const getCacheKey = (offset: number, itemsPerPage: number, search: string, sort: string, order: string) =>
    `${offset}-${itemsPerPage}-${search}-${sort}-${order}`;

  const getCache = (key: string = CACHE_KEY): CacheData => {
    try {
      const cache = localStorage.getItem(key);
      return cache ? JSON.parse(cache) : {};
    } catch {
      return {};
    }
  };

  const setCache = (cache: CacheData, key: string = CACHE_KEY) => {
    try {
      localStorage.setItem(key, JSON.stringify(cache));
    } catch (err) {
      if (err instanceof Error && err.name === 'QuotaExceededError') {
        clearStaleCache();
      }
    }
  };

  const clearStaleCache = () => {
    const cache = getCache();
    const now = Date.now();
    const freshCache: CacheData = {};
    Object.entries(cache).forEach(([key, entry]) => {
      if (now - entry.timestamp < PAGE_CACHE_TTL) freshCache[key] = entry;
    });
    setCache(freshCache);

    const fullWordsCache = getCache(FULL_WORDS_CACHE_KEY);
    if (fullWordsCache[FULL_WORDS_CACHE_KEY] && now - fullWordsCache[FULL_WORDS_CACHE_KEY].timestamp >= FULL_CACHE_TTL) {
      setCache({}, FULL_WORDS_CACHE_KEY);
    }
  };

  const getCachedData = (offset: number, itemsPerPage: number, search: string, sort: string, order: string) => {
    const entry = getCache()[getCacheKey(offset, itemsPerPage, search, sort, order)];
    return entry && Date.now() - entry.timestamp < PAGE_CACHE_TTL ? entry.data : null;
  };

  const getCachedDataAllowExpired = (
    offset: number,
    itemsPerPage: number,
    search: string,
    sort: string,
    order: string,
  ) => getCache()[getCacheKey(offset, itemsPerPage, search, sort, order)]?.data ?? null;

  const getCachedFullWords = (): Word[] | null => {
    const cache = getCache(FULL_WORDS_CACHE_KEY);
    return cache[FULL_WORDS_CACHE_KEY]?.data.documents ?? null;
  };

  const setCachedFullWords = (data: Word[]) => {
    setCache(
      { [FULL_WORDS_CACHE_KEY]: { data: { documents: data, total: data.length }, timestamp: Date.now() } },
      FULL_WORDS_CACHE_KEY,
    );
  };

  const setCachedData = (
    offset: number,
    itemsPerPage: number,
    search: string,
    sort: string,
    order: string,
    data: WordsResponse,
  ) => {
    const cache = getCache();
    cache[getCacheKey(offset, itemsPerPage, search, sort, order)] = { data, timestamp: Date.now() };
    setCache(cache);
  };

  /** Single place that decides whether a page replaces or extends the list. */
  const applyPage = useCallback(
    (page: number, itemsPerPage: number, docs: Word[], total: number, append: boolean) => {
      setWords((prev) => {
        if (!append) return docs;
        const seen = new Set(prev.map((w) => w.$id));
        return [...prev, ...docs.filter((w) => !seen.has(w.$id))];
      });
      setTotalWords(total);
      setTotalPages(Math.ceil(total / itemsPerPage));
      setCurrentPage(page);
      setHasMore(page * itemsPerPage < total);
    },
    [],
  );

  const fetchWords = useCallback(
    async (
      page: number = currentPage,
      itemsPerPage: number = limit,
      search: string = searchTerm,
      sort: string = sortBy,
      order: string = sortOrder,
      append = false,
    ) => {
      const ticket = ++requestId.current;
      const isCurrent = () => ticket === requestId.current;
      const offset = (page - 1) * itemsPerPage;

      setLoading(true);
      setError(null);

      // ---- offline: serve whatever cache we have
      if (!navigator.onLine) {
        const offlineData = getCachedDataAllowExpired(offset, itemsPerPage, search, sort, order);
        if (offlineData) {
          if (isCurrent()) {
            applyPage(page, itemsPerPage, offlineData.documents, offlineData.total, append);
            setError('Offline — showing saved results.');
          }
          setLoading(false);
          return;
        }

        const fullCachedWords = getCachedFullWords();
        if (fullCachedWords) {
          let filteredWords = fullCachedWords;
          if (search) {
            const lowerCaseSearch = search.toLowerCase();
            filteredWords = filteredWords.filter(
              (word) =>
                word.word.toLowerCase().includes(lowerCaseSearch) ||
                word.pronunciation.toLowerCase().includes(lowerCaseSearch) ||
                word.definitions.some((def) => def.toLowerCase().includes(lowerCaseSearch)),
            );
          }

          filteredWords.sort((a, b) => {
            let compare = 0;
            if (sort === 'word') compare = a.word.localeCompare(b.word);
            else if (sort === 'dateAdded') compare = new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime();
            else if (sort === 'likes') compare = a.likes - b.likes;
            return order === 'asc' ? compare : -compare;
          });

          const paginatedWords = filteredWords.slice(offset, offset + itemsPerPage);
          if (isCurrent()) {
            applyPage(page, itemsPerPage, paginatedWords, filteredWords.length, append);
            setError('Offline — showing saved results.');
          }
          setLoading(false);
          return;
        }

        if (isCurrent()) setError('You are offline and no saved copy of the dictionary is available yet.');
        setLoading(false);
        return;
      }

      // ---- online: fresh cache first
      const cachedData = getCachedData(offset, itemsPerPage, search, sort, order);
      if (cachedData) {
        if (isCurrent()) applyPage(page, itemsPerPage, cachedData.documents, cachedData.total, append);
        setLoading(false);
        return;
      }

      try {
        const queries = [
          Query.limit(itemsPerPage),
          Query.offset(offset),
          Query.equal('status', 'approved'),
        ];

        if (search) {
          queries.push(
            Query.or([Query.search('word', search), Query.search('pronunciation', search)]),
          );
        }

        if (sort === 'word') queries.push(order === 'asc' ? Query.orderAsc('word') : Query.orderDesc('word'));
        else if (sort === 'dateAdded') queries.push(order === 'asc' ? Query.orderAsc('dateAdded') : Query.orderDesc('dateAdded'));
        else if (sort === 'likes') queries.push(order === 'asc' ? Query.orderAsc('likes') : Query.orderDesc('likes'));

        const response = await tables.listRows<Word>(DATABASE_ID, COLLECTION_ID, queries);

        const wordsResponse: WordsResponse = { documents: response.rows as Word[], total: response.total };
        setCachedData(offset, itemsPerPage, search, sort, order, wordsResponse);

        const fullWordsCache = getCache(FULL_WORDS_CACHE_KEY);
        if (
          !fullWordsCache[FULL_WORDS_CACHE_KEY] ||
          Date.now() - fullWordsCache[FULL_WORDS_CACHE_KEY].timestamp >= FULL_CACHE_TTL
        ) {
          const allWordsResponse = await tables.listRows<Word>(DATABASE_ID, COLLECTION_ID, [
            Query.limit(10000),
            Query.equal('status', 'approved'),
          ]);
          setCachedFullWords(allWordsResponse.rows as Word[]);
        }

        if (isCurrent()) applyPage(page, itemsPerPage, wordsResponse.documents, wordsResponse.total, append);
      } catch (err) {
        const fallbackData = getCachedDataAllowExpired(offset, itemsPerPage, search, sort, order);
        if (fallbackData && isCurrent()) {
          applyPage(page, itemsPerPage, fallbackData.documents, fallbackData.total, append);
          setError('Network unavailable — showing saved results.');
        } else if (isCurrent()) {
          setError(err instanceof Error ? err.message : 'Could not load the dictionary.');
        }
      } finally {
        if (isCurrent()) setLoading(false);
      }
    },
    [applyPage, currentPage, limit, searchTerm, sortBy, sortOrder],
  );

  const handleSearch = useCallback(
    (term: string) => {
      setSearchTerm(term);
      setCurrentPage(1);
      fetchWords(1, limit, term, sortBy, sortOrder, false);
    },
    [fetchWords, limit, sortBy, sortOrder],
  );

  const handleSort = useCallback(
    (field: 'word' | 'dateAdded' | 'likes', order?: 'asc' | 'desc') => {
      const newSortOrder = order || (sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc');
      setSortBy(field);
      setSortOrder(newSortOrder);
      setCurrentPage(1);
      fetchWords(1, limit, searchTerm, field, newSortOrder, false);
    },
    [fetchWords, limit, searchTerm, sortBy, sortOrder],
  );

  const changeLimit = useCallback(
    (newLimit: number) => {
      setLimit(newLimit);
      setCurrentPage(1);
      fetchWords(1, newLimit, searchTerm, sortBy, sortOrder, false);
    },
    [fetchWords, searchTerm, sortBy, sortOrder],
  );

  /** Append the next page instead of replacing what the reader is browsing. */
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    await fetchWords(currentPage + 1, limit, searchTerm, sortBy, sortOrder, true);
  }, [fetchWords, currentPage, hasMore, limit, loading, searchTerm, sortBy, sortOrder]);

  const nextPage = useCallback(() => {
    if (currentPage < totalPages) fetchWords(currentPage + 1, limit, searchTerm, sortBy, sortOrder, false);
  }, [currentPage, fetchWords, limit, searchTerm, sortBy, sortOrder, totalPages]);

  const prevPage = useCallback(() => {
    if (currentPage > 1) fetchWords(currentPage - 1, limit, searchTerm, sortBy, sortOrder, false);
  }, [currentPage, fetchWords, limit, searchTerm, sortBy, sortOrder]);

  const goToPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages) fetchWords(page, limit, searchTerm, sortBy, sortOrder, false);
    },
    [fetchWords, limit, searchTerm, sortBy, sortOrder, totalPages],
  );

  const forceRefresh = useCallback(async () => {
    const cache = getCache();
    delete cache[getCacheKey((currentPage - 1) * limit, limit, searchTerm, sortBy, sortOrder)];
    setCache(cache);
    setCache({}, FULL_WORDS_CACHE_KEY);
    await fetchWords(currentPage, limit, searchTerm, sortBy, sortOrder, false);
  }, [currentPage, fetchWords, limit, searchTerm, sortBy, sortOrder]);

  useEffect(() => {
    clearStaleCache();
  }, []);

  // first page only: page-to-page moves are explicit (loadMore / goToPage),
  // otherwise appending a page would immediately be replaced again
  useEffect(() => {
    fetchWords(1, initialLimit, '', initialSortBy, initialSortOrder, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    words,
    searchTerm,
    currentPage,
    limit,
    sortBy,
    sortOrder,
    totalPages,
    totalWords,
    loading,
    error,
    hasMore,
    handleSearch,
    handleSort,
    nextPage,
    prevPage,
    goToPage,
    changeLimit,
    loadMore,
    refresh: forceRefresh,
  };
};

export default useFetchWords;
