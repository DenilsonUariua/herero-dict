import { useState } from 'react';
import { KeyRound, Settings2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TranslateComposer } from '@/components/translate/TranslateComposer';
import { TranslationResultCard } from '@/components/translate/TranslationResultCard';
import { TranslateSettingsDialog } from '@/components/translate/TranslateSettingsDialog';
import { useSentenceTranslation } from '@/hooks/useSentenceTranslation';
import { useRagSettings } from '@/lib/rag/settings';

/**
 * The home-page translator: type a sentence, get the other language back,
 * with copy and share sitting right next to the result.
 */
export function QuickTranslate() {
  const { settings, update } = useRagSettings();
  const t = useSentenceTranslation();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const keyProblem = t.error?.code === 'no-key' || t.error?.code === 'bad-key';

  return (
    <>
      <Card className="border-2 border-yellow-900/20 bg-card/80 shadow-sm">
        <CardContent className="space-y-4 p-4 sm:p-5">
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
          />

          {t.error && (
            <Alert variant="destructive">
              <AlertTitle>Could not translate that</AlertTitle>
              <AlertDescription className="space-y-2">
                <span className="block text-sm">{t.error.message}</span>
                {keyProblem && (
                  <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)} className="gap-1.5">
                    <KeyRound className="h-3.5 w-3.5" /> Add an API key
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          {t.result && (
            <TranslationResultCard
              result={t.result}
              compact
              regenerating={t.busy}
              onRegenerate={t.regenerate}
            />
          )}
        </CardContent>
      </Card>

      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[11px] text-muted-foreground">
        <span>Word lookup works offline, no account needed.</span>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="inline-flex items-center gap-1 underline decoration-dotted underline-offset-2 hover:text-foreground"
        >
          <Settings2 className="h-3 w-3" /> Translation settings
        </button>
      </p>

      <TranslateSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onChange={update}
      />
    </>
  );
}
