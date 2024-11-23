import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { likeWord, unlikeWord } from "@/lib/utils";

interface WordDefinition {
  type: string;
  definition: string;
  example?: string;
}

interface WordCardProps {
  word: string;
  pronunciation: string;
  definitions: WordDefinition[];
  likes: number;
}

export const WordCard = ({
  word,
  pronunciation,
  definitions,
  likes,
}: WordCardProps) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(likes || 0);
  const { toast } = useToast();

  const handleLike = (word: string) => {
    if (!isLiked) {
      likeWord(word)
        .then(() => {
          setIsLiked(!isLiked);
          setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1));
          toast({
            description: !isLiked ? `Liked ${word}` : `Unliked ${word}`,
          });
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
  return (
    <Card className="dictionary-card w-full h-full">
      <CardHeader className="p-4">
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="font-bold">{word}</span>
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
              {def.type}
            </Badge>
            <p className="text-sm text-foreground">{def.definition}</p>
            {def.example && (
              <p className="text-xs text-muted-foreground italic">
                &quot;{def.example}&quot;
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
