import { SearchX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyButton } from '@/components/CopyButton';
import { ShareMenu } from '@/components/ShareMenu';
import { formatWordShare, siteUrl } from '@/lib/share';
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
      {result.hits.map((hit, index) => {
        const source = result.direction === 'en-hz' ? hit.en : hit.hz;
        const target = result.direction === 'en-hz' ? hit.hz : hit.en;
        const shareText = formatWordShare(hit.en, hit.hz);

        return (
          <Card key={`${hit.en}-${hit.hz}-${index}`} className="dictionary-card">
            <CardContent className="space-y-1.5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-sm text-muted-foreground">{source}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-lg font-semibold leading-tight text-yellow-900">{target}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
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
                <div className="flex shrink-0 items-center gap-1">
                  <CopyButton
                    value={shareText}
                    label="Copy this word"
                    successMessage="Word copied"
                  />
                  <ShareMenu text={shareText} url={siteUrl()} label="Share this word" />
                </div>
              </div>
              {hit.examples.slice(0, 2).map((example, i) => (
                <div key={i} className="flex items-start justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5">
                  <p className="text-xs text-muted-foreground">
                    {example.en ? `“${example.en}” → ` : ''}
                    <span className="text-foreground">{example.hz}</span>
                  </p>
                  <CopyButton
                    value={example.en ? `${example.en} — ${example.hz}` : example.hz}
                    label="Copy example"
                    successMessage="Example copied"
                    className="h-6 w-6 shrink-0"
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
