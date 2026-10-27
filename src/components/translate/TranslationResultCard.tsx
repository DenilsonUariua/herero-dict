import { useMemo } from 'react';
import { ChevronDown, Info, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { CopyButton } from '@/components/CopyButton';
import { ShareMenu } from '@/components/ShareMenu';
import { formatSentenceShare, siteUrl } from '@/lib/share';
import type { TranslationResult } from '@/lib/rag/types';

interface TranslationResultCardProps {
  result: TranslationResult;
  onRegenerate?: () => void;
  regenerating?: boolean;
  /** Tighter layout for the home-page widget: no retrieval debug panel. */
  compact?: boolean;
}

function confidenceMeta(value: number) {
  if (value >= 0.8) return { label: 'High confidence', className: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
  if (value >= 0.6) return { label: 'Moderate confidence', className: 'bg-amber-100 text-amber-900 border-amber-300' };
  if (value >= 0.4) return { label: 'Low confidence', className: 'bg-orange-100 text-orange-900 border-orange-300' };
  return { label: 'Experimental', className: 'bg-red-100 text-red-900 border-red-300' };
}

export function TranslationResultCard({
  result,
  onRegenerate,
  regenerating,
  compact = false,
}: TranslationResultCardProps) {
  const confidence = confidenceMeta(result.confidence);
  const toHerero = result.direction === 'en-hz';

  const primary = toHerero ? result.herero : result.english;
  const secondary = toHerero ? result.english : result.herero;
  const primaryLabel = toHerero ? 'Otjiherero' : 'English';
  const secondaryLabel = toHerero ? 'Back-translation' : 'Otjiherero input';

  const glossText = useMemo(
    () => result.gloss.map((row) => `${row.en || '—'} — ${row.hz || '—'}`).join('\n'),
    [result.gloss],
  );

  const shareText = useMemo(() => formatSentenceShare(primary, secondary), [primary, secondary]);

  const shareUrl = useMemo(() => siteUrl(), []);

  return (
    <Card className={compact ? 'border-2 border-yellow-900/20' : 'dictionary-card border-2 border-yellow-900/20'}>
      <CardHeader className={compact ? 'p-4 pb-2' : 'pb-3'}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {primaryLabel}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={confidence.className}>
              {confidence.label}
            </Badge>
            {result.cached && (
              <Badge variant="secondary" className="text-[10px]">
                cached
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className={compact ? 'space-y-3 p-4 pt-0' : 'space-y-4'}>
        <p
          className={
            compact
              ? 'text-xl font-semibold leading-snug text-foreground'
              : 'text-2xl font-semibold leading-snug text-foreground'
          }
          // the whole point is to get this text into a chat — keep it selectable
          style={{ userSelect: 'text' }}
        >
          {primary}
        </p>

        {secondary && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">{secondaryLabel}:</span> {secondary}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <CopyButton
            value={primary}
            label={`Copy ${primaryLabel}`}
            ariaLabel={`Copy the ${primaryLabel.toLowerCase()} sentence`}
            successMessage="Sentence copied — paste it in your chat"
            variant="outline"
            showLabel
          />
          <ShareMenu text={shareText} url={shareUrl} label="Share this translation" variant="outline" showLabel />
          {onRegenerate && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={onRegenerate}
              disabled={regenerating}
            >
              <RefreshCw className={regenerating ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              Try again
            </Button>
          )}
        </div>

        {result.gloss.length > 0 && (
          <>
            <Separator />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="whitespace-nowrap text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Word by word
                </p>
                <CopyButton
                  value={glossText}
                  label="Copy"
                  ariaLabel="Copy the word-by-word breakdown"
                  successMessage="Word-by-word copy copied"
                  variant="ghost"
                  className="h-auto shrink-0 gap-1 whitespace-nowrap px-1.5 py-0.5 text-[11px] text-muted-foreground"
                  showLabel
                />
              </div>
              <div className="divide-y rounded-md border bg-background/60">
                {result.gloss.map((row, index) => (
                  <div key={`${row.hz}-${index}`} className="grid grid-cols-2 gap-2 px-3 py-1.5 text-sm">
                    <span className="text-muted-foreground">{row.en || '—'}</span>
                    <span className="font-medium">{row.hz || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {result.notes && (
          <div className="flex items-start gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span>{result.notes}</span>
          </div>
        )}

        {result.uncovered.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="font-medium">Not in the dictionary yet:</span>{' '}
              {result.uncovered.join(', ')}. Those parts are the model&apos;s best guess — worth reviewing.
            </span>
          </div>
        )}

        {result.sources.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Grounded in {result.sources.length} dictionar{result.sources.length === 1 ? 'y entry' : 'y entries'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {result.sources.map((source) => (
                <Badge key={source.en} variant="outline" className="gap-1 border-stone-300 font-normal">
                  <Sparkles className="h-3 w-3 text-yellow-700" />
                  {source.en}
                  {source.hz[0] ? ` · ${source.hz[0]}` : ''}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {!compact && (
          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-1 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
              <span>Retrieved context sent to the model ({result.context.length})</span>
              <ChevronDown className="h-3.5 w-3.5 transition-transform data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-2 rounded-md border bg-background/60 p-3 text-xs">
                {result.context.length === 0 && <p className="text-muted-foreground">No dictionary entries matched.</p>}
                {result.context.map((block) => (
                  <div key={`${block.source}-${block.id}`}>
                    <p className="font-semibold text-foreground">
                      {block.en}
                      {block.qualifier ? ` (${block.qualifier})` : ''}
                      <span className="ml-1.5 font-normal text-muted-foreground">score {block.score.toFixed(1)}</span>
                      {block.source === 'live' && (
                        <Badge variant="secondary" className="ml-1.5 px-1 py-0 text-[9px]">live</Badge>
                      )}
                    </p>
                    {block.hz.length > 0 && <p className="text-muted-foreground">{block.hz.join(' · ')}</p>}
                    {block.examples.map((example, index) => (
                      <p key={index} className="text-muted-foreground">
                        {example.en ? `“${example.en}” → ` : ''}
                        {example.hz}
                      </p>
                    ))}
                  </div>
                ))}
                <p className="pt-1 text-[10px] text-muted-foreground">
                  model: {result.model} · {new Date(result.createdAt).toLocaleString()}
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
