import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Languages, Search, Settings2 } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import MetaTags from '@/components/MetaTags';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TranslationResultCard } from '@/components/translate/TranslationResultCard';
import { WordLookupResults } from '@/components/translate/WordLookupResults';
import { TranslateSettingsDialog } from '@/components/translate/TranslateSettingsDialog';
import { TranslateComposer } from '@/components/translate/TranslateComposer';
import { useSentenceTranslation } from '@/hooks/useSentenceTranslation';
import { useRagSettings } from '@/lib/rag/settings';
import { translateWord, getLexiconStats } from '@/lib/rag/translate';
import type { WordLookupResult } from '@/lib/rag/retriever';

const Translate = () => {
  const { settings, update } = useRagSettings();
  const t = useSentenceTranslation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tab, setTab] = useState<'sentence' | 'word'>('sentence');

  const [wordQuery, setWordQuery] = useState('');
  const [wordResult, setWordResult] = useState<WordLookupResult | null>(null);
  const [stats, setStats] = useState<{ entries: number; terms: number; examples: number; generatedAt: string } | null>(null);

  useEffect(() => {
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
    const timer = setTimeout(async () => {
      try {
        // search both sides: someone typing Otjiherero into an English-first
        // dictionary should not get an empty state
        const [englishSide, hereroSide] = await Promise.all([
          translateWord(query, 'en-hz'),
          translateWord(query, 'hz-en'),
        ]);
        if (cancelled) return;

        const seen = new Set<string>();
        const hits = [...englishSide.hits, ...hereroSide.hits].filter((hit) => {
          const key = `${hit.en}|${hit.hz}`.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        setWordResult({ direction: 'en-hz', query, hits: hits.slice(0, 10) });
      } catch {
        if (!cancelled) setWordResult(null);
      }
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [wordQuery, tab]);

  const keyProblem = t.error?.code === 'no-key' || t.error?.code === 'bad-key';

  const targetLabel = t.direction === 'en-hz' ? 'Otjiherero' : 'English';

  const subtitle = useMemo(
    () =>
      `Look up single words in both directions, or turn a whole sentence into ${targetLabel} — grounded in ${
        stats?.entries ?? 'the'
      } dictionary entries.`,
    [stats?.entries, targetLabel],
  );

  return (
    <>
      <MetaTags
        title="Translate English ⇄ Otjiherero — Otjiherero Dictionary"
        description="Look up words in both directions and generate Otjiherero sentences grounded in the dictionary."
      />
      <Navbar />

      <main className="min-h-screen px-4 pb-28 pt-4 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-5">
          <header className="space-y-2 pt-2 text-center">
            <h1 className="flex items-center justify-center gap-2 text-2xl font-bold text-foreground sm:text-3xl">
              <Languages className="h-6 w-6 text-yellow-900" />
              Translate
            </h1>
            <p className="mx-auto max-w-xl text-sm text-muted-foreground">{subtitle}</p>
          </header>

          <Card>
            <CardContent className="space-y-4 p-4 sm:p-5">
              <Tabs value={tab} onValueChange={(value) => setTab(value as 'sentence' | 'word')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="sentence" className="gap-1.5">
                    <Languages className="h-3.5 w-3.5" /> Sentence
                  </TabsTrigger>
                  <TabsTrigger value="word" className="gap-1.5">
                    <Search className="h-3.5 w-3.5" /> Word
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="sentence" className="mt-4 space-y-4">
                  <TranslateComposer
                    direction={t.direction}
                    onDirectionChange={(direction) => {
                      if (direction !== t.direction) t.swapDirection();
                    }}
                    value={t.text}
                    onChange={t.setText}
                    onSubmit={() => t.run(t.text)}
                    busy={t.busy}
                    stage={t.stage}
                    rows={4}
                  />

                  {t.error && (
                    <Alert variant="destructive">
                      <AlertTitle>Could not translate</AlertTitle>
                      <AlertDescription className="space-y-2">
                        <span className="block text-sm">{t.error.message}</span>
                        {keyProblem && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSettingsOpen(true)}
                            className="gap-1.5"
                          >
                            <KeyRound className="h-3.5 w-3.5" /> Open translation settings
                          </Button>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}

                  {t.result && (
                    <TranslationResultCard
                      result={t.result}
                      regenerating={t.busy}
                      onRegenerate={t.regenerate}
                    />
                  )}
                </TabsContent>

                <TabsContent value="word" className="mt-4 space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={wordQuery}
                      onChange={(event) => setWordQuery(event.target.value)}
                      placeholder="Search a word in either language…"
                      className="bg-background pl-9"
                      spellCheck={false}
                      enterKeyHint="search"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Runs fully offline against the bundled dictionary — no API key needed. Both languages are searched
                    at once.
                  </p>
                  <WordLookupResults result={wordResult} loading={false} />
                </TabsContent>
              </Tabs>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <p className="text-[11px] text-muted-foreground">
                  {stats
                    ? `${stats.entries} entries · ${stats.terms} Otjiherero terms · ${stats.examples} examples`
                    : 'Loading dictionary stats…'}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs text-muted-foreground"
                  onClick={() => setSettingsOpen(true)}
                >
                  <Settings2 className="h-3.5 w-3.5" /> Translation settings
                </Button>
              </div>
            </CardContent>
          </Card>
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
