import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  BookOpenText,
  KeyRound,
  Languages,
  Loader2,
  Search,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import MetaTags from '@/components/MetaTags';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TranslationResultCard } from '@/components/translate/TranslationResultCard';
import { WordLookupResults } from '@/components/translate/WordLookupResults';
import { TranslateSettingsDialog } from '@/components/translate/TranslateSettingsDialog';
import { useRagSettings } from '@/lib/rag/settings';
import { translateSentence, translateWord, getLexiconStats, type TranslateStage } from '@/lib/rag/translate';
import { probeServer, type ServerProbe } from '@/lib/rag/provider';
import type { Direction, RagError, TranslationResult } from '@/lib/rag/types';
import type { WordLookupResult } from '@/lib/rag/retriever';

const EXAMPLES: Record<Direction, string[]> = {
  'en-hz': [
    'He works in a marvellous way.',
    'The child is wet.',
    'Where do you stay?',
    'All the people have been wiped out.',
  ],
  'hz-en': ['Omuatje wa ningena.', 'U tura pi?', 'Ovandu avehe va pondoka.'],
};

const STAGE_LABEL: Record<TranslateStage, string> = {
  retrieving: 'Searching the dictionary…',
  generating: 'Composing Otjiherero…',
  validating: 'Checking the result…',
};

const Translate = () => {
  const { settings, update } = useRagSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tab, setTab] = useState<'sentence' | 'word'>('sentence');
  const [direction, setDirection] = useState<Direction>('en-hz');

  const [sentence, setSentence] = useState('');
  const [wordQuery, setWordQuery] = useState('');

  const [result, setResult] = useState<TranslationResult | null>(null);
  const [wordResult, setWordResult] = useState<WordLookupResult | null>(null);
  const [lastRequest, setLastRequest] = useState('');

  const [stage, setStage] = useState<TranslateStage | null>(null);
  const [error, setError] = useState<{ code?: string; message: string } | null>(null);
  const [probe, setProbe] = useState<ServerProbe | null>(null);
  const [stats, setStats] = useState<{ entries: number; terms: number; examples: number; generatedAt: string } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const busy = stage !== null;

  useEffect(() => {
    probeServer().then(setProbe);
    getLexiconStats().then(setStats).catch(() => setStats(null));
  }, []);

  // ---- word lookup: offline, so debounce instead of a button
  useEffect(() => {
    if (tab !== 'word') return;
    const query = wordQuery.trim();
    if (!query) {
      setWordResult(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      translateWord(query, direction)
        .then((res) => {
          if (!cancelled) setWordResult(res);
        })
        .catch(() => {
          if (!cancelled) setWordResult(null);
        });
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [wordQuery, direction, tab]);

  const runTranslation = useCallback(
    async (text: string, options: { bypassCache?: boolean } = {}) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setError(null);
      setStage('retrieving');
      try {
        const res = await translateSentence({
          text: trimmed,
          direction,
          settings,
          signal: controller.signal,
          onStage: setStage,
          bypassCache: options.bypassCache,
        });
        setResult(res);
        setLastRequest(trimmed);
      } catch (err) {
        const ragError = err as RagError;
        if (ragError?.name === 'AbortError' || controller.signal.aborted) return;
        setError({
          code: ragError?.code,
          message: ragError?.message ?? 'Translation failed. Please try again.',
        });
        setResult(null);
      } finally {
        // only the request that is still current may clear the busy state,
        // otherwise an aborted request would stop the spinner of its successor
        if (abortRef.current === controller) {
          abortRef.current = null;
          setStage(null);
        }
      }
    },
    [busy, direction, settings],
  );

  useEffect(() => () => abortRef.current?.abort(), []);

  const swapDirection = () => {
    setDirection((prev) => (prev === 'en-hz' ? 'hz-en' : 'en-hz'));
    setResult(null);
    setError(null);
    setWordResult(null);
    setSentence('');
    setWordQuery('');
  };

  const needsKey = useMemo(() => {
    if (settings.apiKey) return false;
    if (probe?.configured) return false;
    return true;
  }, [settings.apiKey, probe]);

  const sourceLabel = direction === 'en-hz' ? 'English' : 'Otjiherero';
  const targetLabel = direction === 'en-hz' ? 'Otjiherero' : 'English';

  return (
    <>
      <MetaTags
        title="Translate English ⇄ Otjiherero — Otjiherero Dictionary"
        description="Look up words in both directions and generate Otjiherero sentences grounded in the dictionary."
      />
      <Navbar />

      <main className="min-h-screen p-4 pb-24 sm:p-6">
        <div className="mx-auto max-w-3xl space-y-5">
          <header className="space-y-2 text-center">
            <h1 className="flex items-center justify-center gap-2 text-3xl font-bold text-foreground">
              <Languages className="h-7 w-7 text-yellow-900" />
              Translate
            </h1>
            <p className="text-sm text-muted-foreground">
              Dictionary lookup in both directions, plus sentence generation grounded in {stats?.entries ?? '…'} dictionary entries.
            </p>
          </header>

          {needsKey && tab === 'sentence' && (
            <Alert className="border-amber-300 bg-amber-50">
              <KeyRound className="h-4 w-4 text-amber-800" />
              <AlertTitle className="text-amber-900">Sentence translation needs a language model</AlertTitle>
              <AlertDescription className="text-amber-900/90">
                <span className="block text-sm">
                  Word lookup works right now with no setup. To generate sentences, add an API key — it is stored in this
                  browser only.
                </span>
                <Button
                  size="sm"
                  className="mt-2 bg-yellow-900 hover:bg-yellow-950"
                  onClick={() => setSettingsOpen(true)}
                >
                  Add a key
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
                  <button
                    type="button"
                    onClick={() => direction !== 'en-hz' && swapDirection()}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      direction === 'en-hz' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    English → Otjiherero
                  </button>
                  <button
                    type="button"
                    onClick={() => direction !== 'hz-en' && swapDirection()}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      direction === 'hz-en' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Otjiherero → English
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={swapDirection} title="Swap direction">
                    <ArrowRightLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)} title="Translation settings">
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Tabs value={tab} onValueChange={(value) => setTab(value as 'sentence' | 'word')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="sentence" className="gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> Sentence
                  </TabsTrigger>
                  <TabsTrigger value="word" className="gap-1.5">
                    <Search className="h-3.5 w-3.5" /> Word
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="sentence" className="mt-4 space-y-3">
                  <Textarea
                    value={sentence}
                    onChange={(event) => setSentence(event.target.value)}
                    onKeyDown={(event) => {
                      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                        event.preventDefault();
                        runTranslation(sentence);
                      }
                    }}
                    placeholder={
                      direction === 'en-hz'
                        ? 'Type an English sentence, e.g. “The child is wet.”'
                        : 'Type an Otjiherero sentence, e.g. “Omuatje wa ningena.”'
                    }
                    rows={3}
                    maxLength={1200}
                    className="resize-none bg-background"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {EXAMPLES[direction].slice(0, 3).map((example) => (
                        <button
                          key={example}
                          type="button"
                          onClick={() => setSentence(example)}
                          className="rounded-full border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-yellow-900/40 hover:text-foreground"
                        >
                          {example}
                        </button>
                      ))}
                    </div>

                    <Button
                      onClick={() => runTranslation(sentence)}
                      disabled={busy || !sentence.trim()}
                      className="bg-yellow-900 hover:bg-yellow-950"
                    >
                      {busy ? (
                        <>
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                          {STAGE_LABEL[stage as TranslateStage] ?? 'Working…'}
                        </>
                      ) : (
                        <>
                          Translate to {targetLabel}
                          <BookOpenText className="ml-1.5 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertTitle>Could not translate</AlertTitle>
                      <AlertDescription className="space-y-2">
                        <span className="block text-sm">{error.message}</span>
                        {(error.code === 'no-key' || error.code === 'bad-key') && (
                          <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
                            Open translation settings
                          </Button>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}

                  {result && (
                    <TranslationResultCard
                      result={result}
                      regenerating={busy}
                      onRegenerate={() => runTranslation(lastRequest || sentence, { bypassCache: true })}
                    />
                  )}
                </TabsContent>

                <TabsContent value="word" className="mt-4 space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={wordQuery}
                      onChange={(event) => setWordQuery(event.target.value)}
                      placeholder={`Search ${sourceLabel} words…`}
                      className="bg-background pl-9"
                      spellCheck={false}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Runs fully offline against the bundled dictionary — no API key needed.
                  </p>
                  <WordLookupResults result={wordResult} loading={false} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {stats && (
            <p className="text-center text-[11px] text-muted-foreground">
              Lexicon: {stats.entries} entries · {stats.terms} Otjiherero terms · {stats.examples} example sentences
              {stats.generatedAt ? ` · built ${new Date(stats.generatedAt).toLocaleDateString()}` : ''}
            </p>
          )}
        </div>
      </main>

      <TranslateSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onChange={update}
      />
    </>
  );
};

export default Translate;
