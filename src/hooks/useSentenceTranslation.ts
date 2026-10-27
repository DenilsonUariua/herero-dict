import { useCallback, useEffect, useRef, useState } from 'react';
import { useRagSettings } from '@/lib/rag/settings';
import type { TranslateStage } from '@/lib/rag/translate';
import { probeServer } from '@/lib/rag/provider';
import type { Direction, RagError, TranslationResult } from '@/lib/rag/types';

export interface TranslationError {
  code?: string;
  message: string;
}

export const STAGE_LABEL: Record<TranslateStage, string> = {
  retrieving: 'Searching the dictionary…',
  generating: 'Composing Otjiherero…',
  validating: 'Checking the result…',
};

export const EXAMPLE_SENTENCES: Record<Direction, string[]> = {
  'en-hz': [
    'The child is wet.',
    'He works in a marvellous way.',
    'Where do you stay?',
    'All the people have been wiped out.',
  ],
  'hz-en': ['Omuatje wa ningena.', 'U tura pi?', 'Ovandu avehe va pondoka.'],
};

/**
 * One sentence-translation state machine, shared by the home page widget and
 * the full /translate page so the two never drift apart.
 */
export function useSentenceTranslation(initialDirection: Direction = 'en-hz') {
  const { settings } = useRagSettings();
  const [direction, setDirection] = useState<Direction>(initialDirection);
  const [text, setText] = useState('');
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [lastRequest, setLastRequest] = useState('');
  const [stage, setStage] = useState<TranslateStage | null>(null);
  const [error, setError] = useState<TranslationError | null>(null);
  const [serverConfigured, setServerConfigured] = useState<boolean | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const busy = stage !== null;
  busyRef.current = busy;

  useEffect(() => {
    let cancelled = false;
    probeServer().then((probe) => {
      if (!cancelled) setServerConfigured(probe.configured);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(
    async (rawText: string, options: { bypassCache?: boolean } = {}) => {
      const trimmed = rawText.trim();
      if (!trimmed) return;

      // a second click should restart, not queue behind the running request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setError(null);
      setStage('retrieving');
      try {
        // the retrieval + prompt bundle is only needed once someone actually
        // asks for a translation, so keep it out of the first paint
        const { translateSentence } = await import('@/lib/rag/translate');
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
    [direction, settings],
  );

  const swapDirection = useCallback(() => {
    // mirror the behaviour of every translate app: flipping the direction
    // carries the result over as the new input instead of wiping the box
    if (result) {
      const output = result.direction === 'en-hz' ? result.herero : result.english;
      if (output) setText(output);
    }
    setDirection((prev) => (prev === 'en-hz' ? 'hz-en' : 'en-hz'));
    setResult(null);
    setError(null);
  }, [result]);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
    setText('');
    setLastRequest('');
  }, []);

  return {
    direction,
    setDirection,
    swapDirection,
    text,
    setText,
    result,
    lastRequest,
    stage,
    busy,
    error,
    serverConfigured,
    /** true when sentence translation will definitely fail without a key */
    needsKey: serverConfigured === false && !settings.apiKey,
    run,
    clear,
    regenerate: () => run(lastRequest || text, { bypassCache: true }),
  };
}
