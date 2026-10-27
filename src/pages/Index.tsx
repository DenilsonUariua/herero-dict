import { SearchBar } from '@/components/SearchBar';
import { WordCard } from '@/components/WordCard';
import { Navbar } from '@/components/Navbar';
import { WotdCard } from '@/components/WotdCard';
import { QuickTranslate } from '@/components/translate/QuickTranslate';
import useFetchWords from '@/hooks/useFetchWords';
import MetaTags from '@/components/MetaTags';
import MessagePopup from '@/components/MessagePopup';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, ArrowDown, Languages, Loader2, WifiOff } from 'lucide-react';
import { Link } from 'react-router-dom';

const Index = () => {
  const {
    words,
    totalWords,
    loading,
    error,
    hasMore,
    loadMore,
    handleSearch,
    searchTerm,
  } = useFetchWords();

  const initialLoad = loading && words.length === 0;
  const searching = searchTerm.trim().length > 0;

  return (
    <>
      <MetaTags
        title="Otjiherero Dictionary - Discover the Otjiherero Language"
        description="Explore and discover words from the Otjiherero language. Translate sentences between English and Otjiherero, look up definitions and examples."
      />
      <Navbar />

      <main className="min-h-screen px-4 pb-20 pt-6 sm:px-6">
        {/* ---------------------------------------------------------- hero */}
        <header className="mx-auto max-w-3xl space-y-3 text-center">
          <h1 className="text-3xl font-bold leading-tight text-foreground sm:text-4xl">
            Otjiherero Dictionary
          </h1>
          <p className="mx-auto max-w-xl text-sm text-muted-foreground sm:text-base">
            Type a sentence to see it in the other language, or look up a single word.
            Free, no account needed.
          </p>
        </header>

        <div className="mx-auto mt-6 max-w-3xl space-y-3">
          <QuickTranslate />
        </div>

        {/* ---------------------------------------------------------- browse */}
        <section className="mx-auto mt-12 max-w-7xl space-y-4">
          <div className="mx-auto flex max-w-3xl flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Browse the dictionary</h2>
              <p className="text-xs text-muted-foreground">
                {searching
                  ? `Results for “${searchTerm.trim()}”`
                  : `${totalWords.toLocaleString()} words, English and Otjiherero`}
              </p>
            </div>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs" asChild>
              <Link to="/translate">
                <Languages className="h-3.5 w-3.5" /> Open the translator
              </Link>
            </Button>
          </div>

          <WotdCard />

          <SearchBar onSearch={handleSearch} searchTerm={searchTerm} />

          {error && (
            <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <WifiOff className="h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {initialLoad &&
              Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-40 w-full rounded-xl" />
              ))}

            {words.map((word, index) => (
              <WordCard key={word.$id ?? index} {...word} />
            ))}
          </div>

          {!initialLoad && !loading && words.length === 0 && (
            <div className="mx-auto flex max-w-md flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {searching ? (
                  <>
                    No entry for “{searchTerm.trim()}”. Try a shorter word, or{' '}
                    <Link to="/translate" className="underline underline-offset-2">
                      translate a sentence
                    </Link>{' '}
                    instead.
                  </>
                ) : (
                  'The dictionary is empty right now. Please try again in a moment.'
                )}
              </p>
            </div>
          )}

          {words.length > 0 && (
            <div className="flex flex-col items-center gap-2 pt-2">
              {hasMore ? (
                <Button variant="outline" onClick={loadMore} disabled={loading} className="gap-1.5">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                    </>
                  ) : (
                    <>
                      <ArrowDown className="h-4 w-4" /> Load more words
                    </>
                  )}
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">That&apos;s the whole dictionary.</p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Showing {words.length.toLocaleString()} of {totalWords.toLocaleString()}
              </p>
            </div>
          )}
        </section>

        <footer className="mx-auto mt-12 max-w-3xl space-y-2 border-t pt-6 text-center text-xs text-muted-foreground">
          <p>
            Tap <span className="font-medium text-foreground">copy</span> on any card to paste the word straight into
            WhatsApp or Messenger.
          </p>
          <p>
            Developed by{' '}
            <a
              className="underline underline-offset-2"
              href="https://github.com/DenilsonUariua"
              target="_blank"
              rel="noreferrer"
            >
              Tjariove
            </a>
          </p>
        </footer>
      </main>

      <MessagePopup />
    </>
  );
};

export default Index;
