import { SearchX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { WordLookupResult } from '@/lib/rag/retriever';

interface WordLookupResultsProps {
  result: WordLookupResult | null;
  loading: boolean;
}

const MATCH_LABEL: Record<string, string> = {
  exact: 'exact',
  prefix: 'starts with',
  stem: 'same root',
  fuzzy: 'similar spelling',
};

export function WordLookupResults({ result, loading }: WordLookupResultsProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!result) return null;

  if (!result.hits.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
          <SearchX className="h-4 w-4 shrink-0" />
          <span>
            No entry for &quot;{result.query}&quot;. Try a shorter form, or use the sentence tab to see how the
            model handles it.
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {result.hits.map((hit, index) => (
        <Card key={`${hit.en}-${hit.hz}-${index}`} className="dictionary-card">
          <CardContent className="space-y-1.5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-base font-semibold">{result.direction === 'en-hz' ? hit.en : hit.hz}</span>
                <span className="text-muted-foreground">→</span>
                <span className="text-base font-semibold text-yellow-900">
                  {result.direction === 'en-hz' ? hit.hz : hit.en}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {hit.classPrefix && (
                  <Badge variant="outline" className="border-stone-300 font-normal">
                    pl. {hit.classPrefix}-
                  </Badge>
                )}
                <Badge variant="secondary" className="text-[10px] font-normal">
                  {MATCH_LABEL[hit.matchType] ?? hit.matchType}
                </Badge>
              </div>
            </div>
            {hit.examples.slice(0, 1).map((example, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                {example.en ? `“${example.en}” → ` : ''}
                {example.hz}
              </p>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
