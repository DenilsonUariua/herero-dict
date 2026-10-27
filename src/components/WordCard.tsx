import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useWordLikeCount, useMyLikes, useToggleLike } from '@/hooks/useLikes';
import { CorrectionDialog } from '@/components/CorrectionDialog';
import { CopyButton } from '@/components/CopyButton';
import { ShareMenu } from '@/components/ShareMenu';
import { formatWordShare, siteUrl } from '@/lib/share';
import { displayHeadword, firstDefinition, formatExample, splitHerero } from '@/lib/word-format';

interface WordCardProps {
  word: string;
  $id: string;
  pronunciation: string;
  definitions: string[];
  likes: number;
  example?: string;
  partOfSpeech?: string;
}

export const WordCard = ({
  word,
  $id,
  pronunciation,
  definitions,
  likes,
  example,
}: WordCardProps) => {
  const { user } = useAuth();
  const { data: liveCount } = useWordLikeCount($id);
  const { data: myLikes } = useMyLikes();
  const toggleLike = useToggleLike();

  const headword = displayHeadword(word);
  const { term, plural } = splitHerero(pronunciation);
  const definition = firstDefinition(definitions);
  const exampleText = formatExample(example);

  const isLiked = !!user && (myLikes ?? []).some((l) => l.wordId === $id);
  const likeCount = liveCount ?? likes ?? 0;
  const copyValue = formatWordShare(headword, term);

  const handleLike = () => {
    if (!user) return;
    toggleLike.mutate({ wordId: $id, word: headword });
  };

  return (
    <Card
      className="dictionary-card flex h-full w-full flex-col"
      itemScope
      itemType="https://schema.org/DefinedTerm"
    >
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <h3
            className="min-w-0 text-base font-semibold leading-snug text-foreground"
            itemProp="name"
          >
            {headword}
          </h3>
          <div className="flex shrink-0 items-center gap-0.5">
            <CorrectionDialog
              wordId={$id}
              word={headword}
              pronunciation={pronunciation}
              definitions={definitions ?? []}
            />
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLike}
                disabled={!user || toggleLike.isPending}
                title={user ? (isLiked ? 'Unlike' : 'Like') : 'Log in to like words'}
                aria-label={isLiked ? 'Unlike this word' : 'Like this word'}
                className={
                  isLiked
                    ? 'h-8 w-8 text-red-500 hover:text-red-600'
                    : 'h-8 w-8 text-muted-foreground'
                }
              >
                {toggleLike.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Heart className={isLiked ? 'h-4 w-4 fill-current' : 'h-4 w-4'} />
                )}
              </Button>
              <span className="text-xs font-medium tabular-nums text-muted-foreground">{likeCount}</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-2 p-4 pt-1">
        {!term ? (
          <p className="text-sm text-muted-foreground">
            No Otjiherero entry yet — know it?{' '}
            <span className="text-foreground">Tap the pencil to suggest a fix.</span>
          </p>
        ) : term.toLowerCase() !== headword.toLowerCase() ? (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="text-lg font-semibold leading-tight text-yellow-900" itemProp="translation">
              {term}
            </p>
            {plural && (
              <Badge variant="outline" className="border-stone-300 font-normal text-muted-foreground">
                pl. {plural}-
              </Badge>
            )}
          </div>
        ) : null}

        {definition && (
          <p className="text-sm leading-snug text-foreground/80" itemProp="definition">
            {definition}
          </p>
        )}

        {exampleText && (
          <p className="border-l-2 border-yellow-900/20 pl-2 text-xs italic text-muted-foreground">
            {exampleText}
          </p>
        )}
      </CardContent>

      <CardFooter className="flex items-center gap-1 p-2 pt-0">
        <CopyButton
          value={copyValue}
          label="Copy word and translation"
          successMessage="Word copied — paste it in your chat"
          className="h-9 w-9"
        />
        <ShareMenu text={copyValue} url={siteUrl()} label="Share this word" className="h-9 w-9" />
      </CardFooter>
    </Card>
  );
};
