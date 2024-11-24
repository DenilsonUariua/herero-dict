import { envConfigs } from '@/configs/env-configs';
import { useState, useEffect } from 'react';

interface Definition {
  _id: string;
  type: string;
  definition: string;
  example: string;
}

export interface Word {
  _id: string;
  word: string;
  pronunciation: string;
  definitions: Definition[];
  dateAdded: string;
  likes: number;
  lastModified: string;
  __v: number;
}

interface WordsResponse {
  words: Word[];
  currentPage: number;
  totalPages: number;
  totalWords: number;
}

interface UseFetchWordsParams {
  initialPage?: number;
  initialLimit?: number;
}

interface CacheEntry {
  data: WordsResponse;
  timestamp: number;
}

interface CacheData {
  [key: string]: CacheEntry;
}

const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 1 week in milliseconds
const CACHE_KEY = 'words_cache';

export const useFetchWords = ({ initialPage = 1, initialLimit = 6 }: UseFetchWordsParams = {}) => {
  const [words, setWords] = useState<Word[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [totalPages, setTotalPages] = useState(0);
  const [totalWords, setTotalWords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { apiBaseUrl } = envConfigs;

  // Cache management functions
  const getCacheKey = (page: number, itemsPerPage: number, search: string) => {
    return `${page}-${itemsPerPage}-${search}`;
  };

  const getCache = (): CacheData => {
    try {
      const cache = localStorage.getItem(CACHE_KEY);
      return cache ? JSON.parse(cache) : {};
    } catch {
      return {};
    }
  };

  const setCache = (cache: CacheData) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      // Handle potential QuotaExceededError
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        // Clear old cache entries
        clearStaleCache();
      }
    }
  };

  const clearStaleCache = () => {
    const cache = getCache();
    const now = Date.now();
    const freshCache: CacheData = {};

    // Keep only fresh entries
    Object.entries(cache).forEach(([key, entry]) => {
      if (now - entry.timestamp < CACHE_DURATION) {
        freshCache[key] = entry;
      }
    });

    setCache(freshCache);
  };

  const getCachedData = (page: number, itemsPerPage: number, search: string): WordsResponse | null => {
    const cache = getCache();
    const cacheKey = getCacheKey(page, itemsPerPage, search);
    const cacheEntry = cache[cacheKey];

    if (cacheEntry && Date.now() - cacheEntry.timestamp < CACHE_DURATION) {
      return cacheEntry.data;
    }

    return null;
  };

  const setCachedData = (page: number, itemsPerPage: number, search: string, data: WordsResponse) => {
    const cache = getCache();
    const cacheKey = getCacheKey(page, itemsPerPage, search);
    
    cache[cacheKey] = {
      data,
      timestamp: Date.now()
    };

    setCache(cache);
  };

  const fetchWords = async (page: number = currentPage, itemsPerPage: number = limit, search: string = searchTerm) => {
    setLoading(true);
    setError(null);
    // Check cache first
    const cachedData = getCachedData(page, itemsPerPage, search);
    if (cachedData) {
      setWords(cachedData.words);
      setCurrentPage(cachedData.currentPage);
      setTotalPages(cachedData.totalPages);
      setTotalWords(cachedData.totalWords);
      setLoading(false);
      return;
    }

    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
        ...(search && { q: search })
      });
      
      const response = await fetch(
        `${apiBaseUrl}/api/words${search ? '/search' : ''}?${queryParams}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch words');
      }
      
      const data: WordsResponse = await response.json();
      
      // Cache the response
      setCachedData(page, itemsPerPage, search, data);

      setWords(data.words);
      setCurrentPage(data.currentPage);
      setTotalPages(data.totalPages);
      setTotalWords(data.totalWords);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Handle search term changes
  const handleSearch = (term: string) => {
    setSearchTerm(term);
    // Reset to first page when searching
    fetchWords(1, limit, term);
  };

  // Function to change items per page
  const changeLimit = (newLimit: number) => {
    setLimit(newLimit);
    fetchWords(1, newLimit, searchTerm);
  };

  // Function to go to next page
  const nextPage = () => {
    if (currentPage < totalPages) {
      fetchWords(currentPage + 1, limit, searchTerm);
    }
  };

  // Function to go to previous page
  const prevPage = () => {
    if (currentPage > 1) {
      fetchWords(currentPage - 1, limit, searchTerm);
    }
  };

  // Function to go to specific page
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      fetchWords(page, limit, searchTerm);
    }
  };

  // Function to force refresh data from API
  const forceRefresh = async () => {
    const cache = getCache();
    const cacheKey = getCacheKey(currentPage, limit, searchTerm);
    delete cache[cacheKey];
    setCache(cache);
    await fetchWords(currentPage, limit, searchTerm);
  };

  // Clean up stale cache entries periodically
  useEffect(() => {
    clearStaleCache();
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchWords();
  }, []); // Empty dependency array for initial fetch only

  return {
    words,
    searchTerm,
    currentPage,
    limit,
    totalPages,
    totalWords,
    loading,
    error,
    handleSearch,
    nextPage,
    prevPage,
    goToPage,
    changeLimit,
    refresh: forceRefresh
  };
};

export default useFetchWords;