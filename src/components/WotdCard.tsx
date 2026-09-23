import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Loader2 } from 'lucide-react';
import { fetchWordOfTheDay } from '@/lib/dictionary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function cleanWord(word: string) {
  return word.replace(/-\s*\d+$/, '').trim().toLocaleUpperCase();
}

export function WotdCard() {
  const { data: word, isLoading } = useQuery({
    queryKey: ['word-of-the-day'],
    queryFn: fetchWordOfTheDay,
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return (
    <Card className="max-w-2xl mx-auto w-full border-yellow-900/30 bg-yellow-50/60 dark:bg-yellow-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-medium text-yellow-900 dark:text-yellow-200 uppercase tracking-wide">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" />
            Word of the Day
          </span>
          <Badge variant="outline" className="border-yellow-900/30 text-yellow-900 dark:text-yellow-200">
            {new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading today&apos;s word...
          </div>
        ) : !word ? (
          <p className="text-muted-foreground py-2 text-sm">No words available yet.</p>
        ) : (
          <>
            <p className="text-2xl font-bold" itemProp="name">{cleanWord(String(word.word))}</p>
            {word.pronunciation ? (
              <p className="text-sm font-mono italic" itemProp="translation">{String(word.pronunciation)}</p>
            ) : null}
            {Array.isArray(word.definitions) && word.definitions[0] ? (
              <p className="text-sm text-muted-foreground" itemProp="definition">{word.definitions[0]}</p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
