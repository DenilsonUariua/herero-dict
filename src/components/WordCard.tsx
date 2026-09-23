import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useWordLikeCount, useMyLikes, useToggleLike } from "@/hooks/useLikes";
import { CorrectionDialog } from "@/components/CorrectionDialog";

interface WordCardProps {
  word: string;
  $id: string;
  pronunciation: string;
  definitions: string[];
  likes: number;
}

export const WordCard = ({
  word,
  $id,
  pronunciation,
  definitions,
  likes,
}: WordCardProps) => {
  const { user } = useAuth();
  const { data: liveCount } = useWordLikeCount($id);
  const { data: myLikes } = useMyLikes();
  const toggleLike = useToggleLike();

  const clean = cleanWord(word);
  const isLiked = !!user && (myLikes ?? []).some((l) => l.wordId === $id);
  const likeCount = liveCount ?? likes ?? 0;
  const translatedWord = pronunciation && pronunciation.length > 1 ? pronunciation : "No Translation Yet 🤔";

  const handleLike = () => {
    if (!user) return;
    toggleLike.mutate({ wordId: $id, word: clean });
  };

  return (
    <Card className="dictionary-card w-full h-full" itemScope itemType="https://schema.org/DefinedTerm">
      <CardHeader className="p-4">
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="font-bold" itemProp="name">{clean}</span>
          <div className="flex items-center gap-1">
            <CorrectionDialog
              wordId={$id}
              word={clean}
              pronunciation={pronunciation}
              definitions={definitions ?? []}
            />
            <div className="relative flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLike}
                disabled={!user || toggleLike.isPending}
                title={user ? (isLiked ? "Unlike" : "Like") : "Log in to like words"}
                className={
                  isLiked
                    ? "text-red-500 hover:text-red-600 p-1"
                    : "text-muted-foreground p-1"
                }
              >
                {toggleLike.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Heart className={isLiked ? "fill-current h-4 w-4" : "h-4 w-4"} />
                )}
              </Button>
              <span className="text-xs font-medium ml-1">{likeCount}</span>
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-0">
        <div className="space-y-1">
          <p className="text-sm text-foreground" itemProp="translation">
            {translatedWord}
          </p>
          <p className="font-mono italic text-sm text-foreground" itemProp="definition">
            {(definitions && definitions[0]) || "No Definition Yet 🤔"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

function cleanWord(word: string) {
  return word.replace(/-\s*\d+$/, "").trim().toLocaleUpperCase();
}
