import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Loader2 } from 'lucide-react';
import { fetchWordOfTheDay } from '@/lib/dictionary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CopyButton } from '@/components/CopyButton';
import { ShareMenu } from '@/components/ShareMenu';
import { formatWordShare, siteUrl } from '@/lib/share';
import { displayHeadword, firstDefinition, splitHerero } from '@/lib/word-format';

export function WotdCard() {
  const { data: word, isLoading } = useQuery({
    queryKey: ['word-of-the-day'],
    queryFn: fetchWordOfTheDay,
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const headword = word ? displayHeadword(String(word.word)) : '';
  const { term } = splitHerero(word?.pronunciation ? String(word.pronunciation) : '');
  const definition = word ? firstDefinition(word.definitions) : null;
  const copyValue = formatWordShare(headword, term);

  return (
    <Card className="mx-auto w-full max-w-3xl border-yellow-900/25 bg-yellow-50/60">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-yellow-900">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            Word of the Day
          </span>
          <Badge variant="outline" className="border-yellow-900/30 text-yellow-900">
            {new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {isLoading ? (
          <div className="flex items-center gap-2 py-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading today&apos;s word…
          </div>
        ) : !word ? (
          <p className="py-2 text-sm text-muted-foreground">No words available yet.</p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-lg font-semibold text-foreground" itemProp="name">
                  {headword}
                </p>
                {term && term.toLowerCase() !== headword.toLowerCase() && (
                  <p className="text-xl font-semibold text-yellow-900" itemProp="translation">
                    {term}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <CopyButton
                  value={copyValue}
                  label="Copy today's word"
                  successMessage="Word copied"
                  className="h-9 w-9"
                />
                <ShareMenu text={copyValue} url={siteUrl()} label="Share today's word" className="h-9 w-9" />
              </div>
            </div>
            {definition && (
              <p className="text-sm text-muted-foreground" itemProp="definition">
                {definition}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
