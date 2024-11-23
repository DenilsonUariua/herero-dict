import { envConfigs } from '@/configs/env-configs';
import { useState, useEffect } from 'react';

interface Definition {
  _id: string;
  type: string;
  definition: string;
  example: string;
}

interface Word {
  _id: string;
  word: string;
  pronunciation: string;
  definitions: Definition[];
  dateAdded: string;
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

export const useFetchWords = ({ initialPage = 1, initialLimit = 6 }: UseFetchWordsParams = {}) => {
  const [words, setWords] = useState<Word[]>([]);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [totalPages, setTotalPages] = useState(0);
  const [totalWords, setTotalWords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {apiBaseUrl} = envConfigs;

  const fetchWords = async (page: number = currentPage, itemsPerPage: number = limit) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/words?page=${page}&limit=${itemsPerPage}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch words');
      }
      
      const data: WordsResponse = await response.json();
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

  // Function to change items per page
  const changeLimit = (newLimit: number) => {
    setLimit(newLimit);
    // Reset to first page when changing limit to avoid pagination issues
    fetchWords(1, newLimit);
  };

  // Function to go to next page
  const nextPage = () => {
    if (currentPage < totalPages) {
      fetchWords(currentPage + 1);
    }
  };

  // Function to go to previous page
  const prevPage = () => {
    if (currentPage > 1) {
      fetchWords(currentPage - 1);
    }
  };

  // Function to go to specific page
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      fetchWords(page);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchWords();
  }, []); // Empty dependency array for initial fetch only

  return {
    words,
    currentPage,
    limit,
    totalPages,
    totalWords,
    loading,
    error,
    nextPage,
    prevPage,
    goToPage,
    changeLimit,
    refresh: () => fetchWords(currentPage, limit)
  };
};

export default useFetchWords;