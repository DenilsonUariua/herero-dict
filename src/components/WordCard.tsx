import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";

interface WordDefinition {
  type: string;
  definition: string;
  example?: string;
}

interface WordCardProps {
  word: string;
  pronunciation: string;
  definitions: WordDefinition[];
}

export const WordCard = ({ word, pronunciation, definitions }: WordCardProps) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const { toast } = useToast();

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
    toast({
      description: !isLiked ? `Added ${word} to favorites` : `Removed ${word} from favorites`,
    });
  };

  return (
    <Card className="dictionary-card w-full max-w-xl mx-auto mt-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="text-2xl font-bold">{word}</span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{pronunciation}</span>
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLike}
                className={isLiked ? "text-red-500 hover:text-red-600" : "text-muted-foreground"}
              >
                <Heart className={isLiked ? "fill-current" : ""} />
              </Button>
              <span className="absolute -right-1 top-1 text-xs font-medium">{likeCount}</span>
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {definitions.map((def, index) => (
          <div key={index} className="space-y-2">
            <Badge variant="secondary" className="mb-2">
              {def.type}
            </Badge>
            <p className="text-foreground">{def.definition}</p>
            {def.example && (
              <p className="text-muted-foreground text-sm italic">
                &quot;{def.example}&quot;
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};