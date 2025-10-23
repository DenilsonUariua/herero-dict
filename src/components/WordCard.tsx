import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { likeWord, unlikeWord } from "@/lib/utils";

interface WordCardProps {
  word: string;
  pronunciation: string;
  definitions: string[];
  likes: number;
  refresh: () => void;
}

export const WordCard = ({
  word,
  pronunciation,
  definitions,
  likes,
  refresh,
}: WordCardProps) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(likes || 0);
  const { toast } = useToast();

  useEffect(() => {
    setLikeCount(likes);
  }, [likes]);

console.log("Definitions: ", definitions);

  /**
   * If the word is not currently liked, it will be liked. If the word is currently liked, it will be unliked.
   * @param {string} word The word to like or unlike
   */
  const handleLike = (word: string) => {
    if (!isLiked) {
      likeWord(word)
        .then(() => {
          setIsLiked(!isLiked);
          setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1));
          toast({
            description: !isLiked ? `Liked ${word}` : `Unliked ${word}`,
          });
          refresh();
        })
        .catch((error) => {
          toast({
            variant: "destructive",
            title: "Error",
            description: `Failed to like ${word}`,
          });
          console.error(error);
        });
    } else {
      unlikeWord(word)
        .then(() => {
          setIsLiked(!isLiked);
          setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1));
          toast({
            description: !isLiked ? `Liked ${word}` : `Unliked ${word}`,
          });
          refresh();
        })
        .catch((error) => {
          toast({
            variant: "destructive",
            title: "Error",
            description: `Failed to unlike ${word}`,
          });
        });
    }
  };
  function cleanWord(word) {
    return word.replace(/-\s*\d+$/, "").trim();
  }

  return (
    <Card className="dictionary-card w-full h-full">
      <CardHeader className="p-4">
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="font-bold">{cleanWord(word)}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {pronunciation}
            </span>
            <div className="relative flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleLike(word)}
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
        {definitions.map((def, index) => (
          <div key={index} className="space-y-1">
            <Badge variant="secondary" className="text-xs">
             <p>{index + 1}</p>
            </Badge>
            <p className="text-sm text-foreground">{def}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
