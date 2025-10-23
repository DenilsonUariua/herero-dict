import { envConfigs } from '@/configs/env-configs';
import { useState, useEffect } from 'react';
import { Client, Databases, Query, Models } from 'appwrite';

export interface Word extends Models.Document {
  word: string;
  pronunciation: string;
  definitions: string[]; // Will be stored as JSON string
  dateAdded: string; // DateTime from Appwrite
  lastModified: string; // DateTime from Appwrite
  likes: number;
  originalWord?: string; // Optional - used for bulk imports
  modified?: boolean; // Optional - indicates if word was renamed
}

interface WordsResponse {
  documents: Word[];
  total: number;
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

const client = new Client()
  .setEndpoint(envConfigs.appwriteEndpoint)
  .setProject(envConfigs.appwriteProjectId);

const databases = new Databases(client);

const DATABASE_ID = envConfigs.appwriteDatabaseId; // Replace with your Appwrite Database ID
const COLLECTION_ID = envConfigs.appwriteCollectionId; // Replace with your Appwrite Collection ID

export const useFetchWords = ({ initialPage = 1, initialLimit = 6 }: UseFetchWordsParams = {}) => {
  const [words, setWords] = useState<Word[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [totalPages, setTotalPages] = useState(0);
  const [totalWords, setTotalWords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cache management functions
  const getCacheKey = (offset: number, itemsPerPage: number, search: string) => {
    return `${offset}-${itemsPerPage}-${search}`;
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

  const getCachedData = (offset: number, itemsPerPage: number, search: string): WordsResponse | null => {
    const cache = getCache();
    const cacheKey = getCacheKey(offset, itemsPerPage, search);
    const cacheEntry = cache[cacheKey];

    if (cacheEntry && Date.now() - cacheEntry.timestamp < CACHE_DURATION) {
      return cacheEntry.data;
    }

    return null;
  };

  const setCachedData = (offset: number, itemsPerPage: number, search: string, data: WordsResponse) => {
    const cache = getCache();
    const cacheKey = getCacheKey(offset, itemsPerPage, search);
    
    cache[cacheKey] = {
      data,
      timestamp: Date.now()
    };

    setCache(cache);
  };

  const fetchWords = async (page: number = currentPage, itemsPerPage: number = limit, search: string = searchTerm) => {
    setLoading(true);
    setError(null);
    const offset = (page - 1) * itemsPerPage;

    // Check cache first
    const cachedData = getCachedData(offset, itemsPerPage, search);
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

      if (search) {
        queries.push(Query.search('word', search));
      }
      
      // Type the response as Word documents
      const response = await databases.listDocuments<Word>(
        DATABASE_ID,
        COLLECTION_ID,
        queries
      );
      
      // Transform response to WordsResponse format
      const wordsResponse: WordsResponse = {
        documents: response.documents as Word[],
        total: response.total
      };
      
      // Cache the response
      setCachedData(offset, itemsPerPage, search, wordsResponse);

      setWords(wordsResponse.documents);
      setTotalWords(wordsResponse.total);
      setTotalPages(Math.ceil(wordsResponse.total / itemsPerPage));
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
    setCurrentPage(1);
    fetchWords(1, limit, term);
  };

  // Function to change items per page
  const changeLimit = (newLimit: number) => {
    setLimit(newLimit);
    setCurrentPage(1);
    fetchWords(1, newLimit, searchTerm);
  };

  // Function to go to next page
  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      fetchWords(currentPage + 1, limit, searchTerm);
    }
  };

  // Function to go to previous page
  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      fetchWords(currentPage - 1, limit, searchTerm);
    }
  };

  // Function to go to specific page
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      fetchWords(page, limit, searchTerm);
    }
  };

  // Function to force refresh data from API
  const forceRefresh = async () => {
    const cache = getCache();
    const offset = (currentPage - 1) * limit;
    const cacheKey = getCacheKey(offset, limit, searchTerm);
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
  }, [currentPage, limit, searchTerm]); // Add dependencies for re-fetching when pagination/search changes

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