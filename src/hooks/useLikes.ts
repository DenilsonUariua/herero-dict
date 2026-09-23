import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { fetchLikeCount, fetchMyLikes, likeWord, unlikeWord, type WordLike } from '@/lib/dictionary';

/** Live like count for a single word (from word_likes rows). */
export function useWordLikeCount(wordId: string) {
  return useQuery({
    queryKey: ['like-count', wordId],
    queryFn: () => fetchLikeCount(wordId),
    staleTime: 30 * 1000,
  });
}

/** All of the current user's liked words (rows carry the denormalized headword). */
export function useMyLikes() {
  const { user } = useAuth();
  return useQuery<WordLike[]>({
    queryKey: ['my-likes', user?.$id ?? 'anon'],
    queryFn: () => fetchMyLikes(user!.$id),
    enabled: !!user,
    staleTime: 30 * 1000,
  });
}

/** Like/unlike mutation for a word. */
export function useToggleLike() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ wordId, word }: { wordId: string; word: string }) => {
      if (!user) throw new Error('You need an account to like words.');
      const likes = await fetchMyLikes(user.$id);
      const alreadyLiked = likes.some((l) => l.wordId === wordId);
      if (alreadyLiked) {
        await unlikeWord(user.$id, wordId);
        return { liked: false };
      }
      await likeWord(user.$id, wordId, word);
      return { liked: true };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['like-count', variables.wordId] });
      queryClient.invalidateQueries({ queryKey: ['my-likes', user?.$id] });
    },
  });
}
