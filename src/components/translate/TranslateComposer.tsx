import { useRef } from 'react';
import { ArrowRight, Languages, Loader2, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { EXAMPLE_SENTENCES, STAGE_LABEL } from '@/hooks/useSentenceTranslation';
import { detectLanguageHint } from '@/lib/lang-detect';
import type { Direction } from '@/lib/rag/types';
import type { TranslateStage } from '@/lib/rag/translate';

interface TranslateComposerProps {
  direction: Direction;
  onDirectionChange: (direction: Direction) => void;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy?: boolean;
  stage?: TranslateStage | null;
  showExamples?: boolean;
  autoFocus?: boolean;
  rows?: number;
  className?: string;
}

/**
 * The "type a sentence" control. Kept presentational so the home page and the
 * full translate page render exactly the same affordance.
 */
export function TranslateComposer({
  direction,
  onDirectionChange,
  value,
  onChange,
  onSubmit,
  busy = false,
  stage = null,
  showExamples = true,
  autoFocus = false,
  rows = 3,
  className,
}: TranslateComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toHerero = direction === 'en-hz';
  const examples = EXAMPLE_SENTENCES[direction];

  // catch the classic mix-up: Otjiherero pasted into the English box
  const detected = detectLanguageHint(value);
  const wrongDirection =
    value.trim().length > 3 && detected !== null && detected !== (toHerero ? 'en' : 'hz')
      ? detected
      : null;

  return (
    <div className={cn('space-y-3', className)}>
      <div
        role="tablist"
        aria-label="Translation direction"
        className="inline-flex w-full items-center gap-1 rounded-lg border bg-muted/40 p-1 sm:w-auto"
      >
        {(
          [
            { value: 'en-hz', label: 'English → Otjiherero' },
            { value: 'hz-en', label: 'Otjiherero → English' },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={direction === option.value}
            onClick={() => onDirectionChange(option.value)}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:flex-none',
              direction === option.value
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            onSubmit();
          }
        }}
        autoFocus={autoFocus}
        enterKeyHint="done"
        placeholder={
          toHerero
            ? 'Type an English sentence, e.g. “The child is wet.”'
            : 'Type an Otjiherero sentence, e.g. “Omuatje wa ningena.”'
        }
        rows={rows}
        maxLength={1200}
        className="resize-none bg-background text-base"
        aria-label={toHerero ? 'English sentence to translate' : 'Otjiherero sentence to translate'}
      />

      {wrongDirection && !busy && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900">
          <Lightbulb className="h-3.5 w-3.5 shrink-0" />
          <span>
            That looks like {wrongDirection === 'hz' ? 'Otjiherero' : 'English'}, not{' '}
            {wrongDirection === 'hz' ? 'English' : 'Otjiherero'}.
          </span>
          <button
            type="button"
            onClick={() => onDirectionChange(wrongDirection === 'hz' ? 'hz-en' : 'en-hz')}
            className="font-medium underline underline-offset-2 hover:text-amber-950"
          >
            Switch direction
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {showExamples ? (
          <div className="no-scrollbar chip-rail -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
            {examples.slice(0, 3).map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  onChange(example);
                  textareaRef.current?.focus();
                }}
                className="shrink-0 whitespace-nowrap rounded-full border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-yellow-900/40 hover:text-foreground"
              >
                {example}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}

        <Button
          onClick={onSubmit}
          disabled={busy || !value.trim()}
          className="w-full shrink-0 bg-yellow-900 hover:bg-yellow-950 disabled:bg-stone-300 disabled:text-stone-700 disabled:opacity-100 sm:w-auto"
        >
          {busy ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              {stage ? STAGE_LABEL[stage] : 'Working…'}
            </>
          ) : (
            <>
              <Languages className="mr-1.5 h-4 w-4" />
              Translate
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
