import { envConfigs } from '@/configs/env-configs';
import { useState, useEffect } from 'react';
import { Client, Databases, Query, Models } from 'appwrite';

export interface Word extends Models.Document {
  word: string;
  pronunciation: string;
  definitions: string[];
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

const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000;
const CACHE_KEY = 'words_cache';
const FULL_WORDS_CACHE_KEY = 'full_words_cache';

const client = new Client()
  .setEndpoint(envConfigs.appwriteEndpoint)
  .setProject(envConfigs.appwriteProjectId);

const databases = new Databases(client);

const DATABASE_ID = envConfigs.appwriteDatabaseId;
const COLLECTION_ID = envConfigs.appwriteCollectionId;

export const useFetchWords = ({
  initialPage = 1, 
  initialLimit = 6,
  initialSortBy = 'word',
  initialSortOrder = 'asc'
}: UseFetchWordsParams = {}) => {
  const [words, setWords] = useState<Word[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [sortBy, setSortBy] = useState<'word' | 'dateAdded' | 'likes'>(initialSortBy);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialSortOrder);
  const [totalPages, setTotalPages] = useState(0);
  const [totalWords, setTotalWords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cache management functions
  const getCacheKey = (
    offset: number, 
    itemsPerPage: number, 
    search: string, 
    sort: string, 
    order: string
  ) => {
    return `${offset}-${itemsPerPage}-${search}-${sort}-${order}`;
  };

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
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        clearStaleCache();
      }
    }
  };

  const clearStaleCache = () => {
    const cache = getCache();
    const now = Date.now();
    const freshCache: CacheData = {};

    Object.entries(cache).forEach(([key, entry]) => {
      if (now - entry.timestamp < CACHE_DURATION) {
        freshCache[key] = entry;
      }
    });

    setCache(freshCache);

    // Also clear stale full words cache
    const fullWordsCache = getCache(FULL_WORDS_CACHE_KEY);
    if (fullWordsCache[FULL_WORDS_CACHE_KEY] && now - fullWordsCache[FULL_WORDS_CACHE_KEY].timestamp >= CACHE_DURATION) {
      setCache({}, FULL_WORDS_CACHE_KEY);
    }
  };

  const getCachedData = (
    offset: number, 
    itemsPerPage: number, 
    search: string, 
    sort: string, 
    order: string
  ): WordsResponse | null => {
    const cache = getCache();
    const cacheKey = getCacheKey(offset, itemsPerPage, search, sort, order);
    const cacheEntry = cache[cacheKey];

    if (cacheEntry && Date.now() - cacheEntry.timestamp < CACHE_DURATION) {
      return cacheEntry.data;
    }

    return null;
  };

  const getCachedDataAllowExpired = (
    offset: number, 
    itemsPerPage: number, 
    search: string, 
    sort: string, 
    order: string
  ): WordsResponse | null => {
    const cache = getCache();
    const cacheKey = getCacheKey(offset, itemsPerPage, search, sort, order);
    const cacheEntry = cache[cacheKey];
    return cacheEntry ? cacheEntry.data : null;
  };

  const getCachedFullWords = (): Word[] | null => {
    const cache = getCache(FULL_WORDS_CACHE_KEY);
    const cacheEntry = cache[FULL_WORDS_CACHE_KEY];
    return cacheEntry ? cacheEntry.data.documents : null;
  };

  const setCachedFullWords = (data: Word[]) => {
    const cache: CacheData = {};
    cache[FULL_WORDS_CACHE_KEY] = {
      data: { documents: data, total: data.length },
      timestamp: Date.now()
    };
    setCache(cache, FULL_WORDS_CACHE_KEY);
  };

  const setCachedData = (
    offset: number, 
    itemsPerPage: number, 
    search: string, 
    sort: string, 
    order: string, 
    data: WordsResponse
  ) => {
    const cache = getCache();
    const cacheKey = getCacheKey(offset, itemsPerPage, search, sort, order);
    
    cache[cacheKey] = {
      data,
      timestamp: Date.now()
    };

    setCache(cache);
  };

  const fetchWords = async (
    page: number = currentPage, 
    itemsPerPage: number = limit, 
    search: string = searchTerm,
    sort: string = sortBy,
    order: string = sortOrder
  ) => {
    setLoading(true);
    setError(null);
    const offset = (page - 1) * itemsPerPage;

    // If offline, use any cached data immediately
    if (!navigator.onLine) {
      const offlineData = getCachedDataAllowExpired(offset, itemsPerPage, search, sort, order);
      if (offlineData) {
        setWords(offlineData.documents);
        setTotalWords(offlineData.total);
        setTotalPages(Math.ceil(offlineData.total / itemsPerPage));
        setLoading(false);
        return;
      }

      // Fallback to full cached words if specific query not found offline
      const fullCachedWords = getCachedFullWords();
      if (fullCachedWords) {
        let filteredWords = fullCachedWords;

        if (search) {
          const lowerCaseSearch = search.toLowerCase();
          filteredWords = filteredWords.filter(word => 
            word.word.toLowerCase().includes(lowerCaseSearch) ||
            word.pronunciation.toLowerCase().includes(lowerCaseSearch) ||
            word.definitions.some(def => def.toLowerCase().includes(lowerCaseSearch))
          );
        }

        // Apply sorting client-side
        filteredWords.sort((a, b) => {
          let compare = 0;
          if (sort === 'word') {
            compare = a.word.localeCompare(b.word);
          } else if (sort === 'dateAdded') {
            compare = new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime();
          } else if (sort === 'likes') {
            compare = a.likes - b.likes;
          }
          return order === 'asc' ? compare : -compare;
        });

        const paginatedWords = filteredWords.slice(offset, offset + itemsPerPage);

        setWords(paginatedWords);
        setTotalWords(filteredWords.length);
        setTotalPages(Math.ceil(filteredWords.length / itemsPerPage));
        setLoading(false);
        setError("Offline: Showing filtered cached results.");
        return;
      }

      // If no cache, show error but stop spinner
      setError("You are offline and no cached data is available.");
      setLoading(false);
      return;
    }

    // Check fresh cache first when online
    const cachedData = getCachedData(offset, itemsPerPage, search, sort, order);
    if (cachedData) {
      setWords(cachedData.documents);
      setTotalWords(cachedData.total);
      setTotalPages(Math.ceil(cachedData.total / itemsPerPage));
      setLoading(false);
      return;
    }

    try {
     const queries = [
        Query.limit(itemsPerPage),
        Query.offset(offset),
      ];

      // Add search query - searches across word, pronunciation, and definitions
      if (search) {
        queries.push(
          Query.or([
            Query.search('word', search),
            Query.search('pronunciation', search)
          ])
        );
      }

      // Add sorting based on available indexes
      // word_sort, date_added_sort, likes_sort
      if (sort === 'word') {
        queries.push(order === 'asc' ? Query.orderAsc('word') : Query.orderDesc('word'));
      } else if (sort === 'dateAdded') {
        queries.push(order === 'asc' ? Query.orderAsc('dateAdded') : Query.orderDesc('dateAdded'));
      } else if (sort === 'likes') {
        queries.push(order === 'asc' ? Query.orderAsc('likes') : Query.orderDesc('likes'));
      }
      
      const response = await databases.listDocuments<Word>(
        DATABASE_ID,
        COLLECTION_ID,
        queries
      );
      
      const wordsResponse: WordsResponse = {
        documents: response.documents as Word[],
        total: response.total
      };
      
      // Cache the response
      setCachedData(offset, itemsPerPage, search, sort, order, wordsResponse);

      // Also fetch and cache the full word list if not already cached or stale
      const fullWordsCache = getCache(FULL_WORDS_CACHE_KEY);
      if (!fullWordsCache[FULL_WORDS_CACHE_KEY] || Date.now() - fullWordsCache[FULL_WORDS_CACHE_KEY].timestamp >= CACHE_DURATION) {
        const allWordsResponse = await databases.listDocuments<Word>(
          DATABASE_ID,
          COLLECTION_ID,
          [Query.limit(10000)] // Assuming 10000 is a sufficiently large limit to get all words
        );
        setCachedFullWords(allWordsResponse.documents as Word[]);
      }

      setWords(wordsResponse.documents);
      setTotalWords(wordsResponse.total);
      setTotalPages(Math.ceil(wordsResponse.total / itemsPerPage));
    } catch (err) {
      // If request fails (e.g., offline during flight), fall back to expired cache
      const fallbackData = getCachedDataAllowExpired(offset, itemsPerPage, search, sort, order);
      if (fallbackData) {
        setWords(fallbackData.documents);
        setTotalWords(fallbackData.total);
        setTotalPages(Math.ceil(fallbackData.total / itemsPerPage));
        setError("Network unavailable — showing cached results.");
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle search term changes
  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
    fetchWords(1, limit, term, sortBy, sortOrder);
  };

  // Handle sort changes
  const handleSort = (field: 'word' | 'dateAdded' | 'likes', order?: 'asc' | 'desc') => {
    const newSortOrder = order || (sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc');
    setSortBy(field);
    setSortOrder(newSortOrder);
    setCurrentPage(1);
    fetchWords(1, limit, searchTerm, field, newSortOrder);
  };

  // Function to change items per page
  const changeLimit = (newLimit: number) => {
    setLimit(newLimit);
    setCurrentPage(1);
    fetchWords(1, newLimit, searchTerm, sortBy, sortOrder);
  };

  // Function to go to next page
  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prevPage => {
        const newPage = prevPage + 1;
        fetchWords(newPage, limit, searchTerm, sortBy, sortOrder);
        return newPage;
      });
    }
  };

  // Function to go to previous page
  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prevPage => {
        const newPage = prevPage - 1;
        fetchWords(newPage, limit, searchTerm, sortBy, sortOrder);
        return newPage;
      });
    }
  };

  // Function to go to specific page
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(() => {
        fetchWords(page, limit, searchTerm, sortBy, sortOrder);
        return page;
      });
    }
  };

  // Function to force refresh data from API
  const forceRefresh = async () => {
    const cache = getCache();
    const offset = (currentPage - 1) * limit;
    const cacheKey = getCacheKey(offset, limit, searchTerm, sortBy, sortOrder);
    delete cache[cacheKey];
    setCache(cache);
    // Also clear the full words cache to force a fresh fetch
    setCache({}, FULL_WORDS_CACHE_KEY);
    await fetchWords(currentPage, limit, searchTerm, sortBy, sortOrder);
  };

  // Clean up stale cache entries periodically
  useEffect(() => {
    clearStaleCache();
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchWords(currentPage, limit, searchTerm, sortBy, sortOrder);
  }, [currentPage, limit, searchTerm, sortBy, sortOrder]); 

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
    handleSearch,
    handleSort,
    nextPage,
    prevPage,
    goToPage,
    changeLimit,
    refresh: forceRefresh
  };
};

export default useFetchWords;