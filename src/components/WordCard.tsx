import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { likeWord, unlikeWord, subscribeToWord } from "@/lib/utils";

interface WordCardProps {
  word: string;
  $id: string;
  pronunciation: string;
  definitions: string[];
  likes: number;
  refresh: () => void;
}

export const WordCard = ({
  word,
  $id,
  pronunciation,
  definitions,
  likes,
  refresh,
}: WordCardProps) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(likes || 0);
  const { toast } = useToast();

  useEffect(() => {
    // Subscribe to realtime updates for this word
    const unsubscribe = subscribeToWord($id, (response) => {
      // Check if it's an update event
      if (response.events.includes(`databases.*.collections.*.documents.*.update`)) {
        setLikeCount(response.payload.likes);
      }
    });

    // Cleanup subscription on unmount
    return () => {
      unsubscribe();
    };
  }, [$id]);

  // Update like count when props change
  useEffect(() => {
    setLikeCount(likes);
  }, [likes]);

  /**
   * If the word is not currently liked, it will be liked. If the word is currently liked, it will be unliked.
   * @param {string} word The word to like or unlike
   */
  const handleLike = async (word: string, wordId: string) => {
    try {
      if (!isLiked) {
        await likeWord(wordId, likeCount);
        setIsLiked(true);
        toast({
          description: `Liked ${word}`,
        });
      } else {
        await unlikeWord(wordId, likeCount);
        setIsLiked(false);
        toast({
          description: `Unliked ${word}`,
        });
      }
      // No need to call refresh() - realtime will update automatically
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to ${isLiked ? 'unlike' : 'like'} ${word}`,
      });
      console.error(error);
    }
  };

  function cleanWord(word: string) {
    return word.replace(/-\s*\d+$/, "").trim().toLocaleUpperCase();
  }

  function getTranslatedWord(pronunciation: string, definitions: string[]) {
    let result = pronunciation;
    if (result.length <= 1) {
      result = "No translation yet 🤔";
    }
    return result;
  }

  return (
    <Card className="dictionary-card w-full h-full" itemScope itemType="https://schema.org/DefinedTerm">
      <CardHeader className="p-4">
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="font-bold" itemProp="name">{cleanWord(word)}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground" itemProp="alternateName">
              
            </span>
            <div className="relative flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleLike(word, $id)}
                className={
                  isLiked
                    ? "text-red-500 hover:text-red-600 p-1"
                    : "text-muted-foreground p-1"
                }
              >
                <Heart
                  className={isLiked ? "fill-current h-4 w-4" : "h-4 w-4"}
                />
              </Button>
              <span className="text-xs font-medium ml-1">{likeCount}</span>
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-0">
        <div className="space-y-1">
          <p className="text-sm text-foreground" itemProp="translation">
            {getTranslatedWord(pronunciation, definitions)}
          </p>
           <p className="font-mono italic text-sm text-foreground" itemProp="definition">
            {definitions[0] || "No Definition yet🤔"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};