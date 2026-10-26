import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, RefreshCw, Server, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PROVIDER_PRESETS, isLocalProvider } from '@/lib/rag/settings';
import { probeServer, testConnection, type ServerProbe } from '@/lib/rag/provider';
import { clearTranslationCache } from '@/lib/rag/translate';
import type { RagSettings } from '@/lib/rag/types';

interface TranslateSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: RagSettings;
  onChange: (patch: Partial<RagSettings>) => void;
}

export function TranslateSettingsDialog({
  open,
  onOpenChange,
  settings,
  onChange,
}: TranslateSettingsDialogProps) {
  const [probe, setProbe] = useState<ServerProbe | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    probeServer().then((result) => {
      if (!cancelled) setProbe(result);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const message = await testConnection(settings);
      setTestResult({ ok: true, message });
    } catch (err) {
      setTestResult({ ok: false, message: (err as Error)?.message ?? 'Connection failed.' });
    } finally {
      setTesting(false);
    }
  };

  const keyless = isLocalProvider(settings.baseUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Translation settings</DialogTitle>
          <DialogDescription>
            Sentence translation needs a language model. Word lookup works offline and needs nothing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="rag-mode">Where should the request go?</Label>
            <Select value={settings.mode} onValueChange={(value) => onChange({ mode: value as RagSettings['mode'] })}>
              <SelectTrigger id="rag-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automatic — server if available, else my key</SelectItem>
                <SelectItem value="server">Server proxy only (key stays on the server)</SelectItem>
                <SelectItem value="byok">My own API key (from this browser)</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Server className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {probe === null && 'Checking for a server-side key…'}
                {probe && probe.available && probe.configured && (
                  <>A server key is configured{probe.model ? ` (${probe.model})` : ''}. No browser key needed.</>
                )}
                {probe && probe.available && !probe.configured && (
                  <>The server proxy is running but has no <code>LLM_API_KEY</code> set.</>
                )}
                {probe && !probe.available && (
                  <>No server proxy detected. Add your own key below, or run <code>npm run dev:full</code>.</>
                )}
              </span>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Model provider</Label>
              <span className="text-xs text-muted-foreground">Any OpenAI-compatible API</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PROVIDER_PRESETS.map((preset) => {
                const active = preset.baseUrl === settings.baseUrl;
                return (
                  <Button
                    key={preset.label}
                    type="button"
                    size="sm"
                    variant={active ? 'default' : 'outline'}
                    className={active ? 'bg-yellow-900 hover:bg-yellow-950' : ''}
                    onClick={() =>
                      preset.baseUrl &&
                      onChange({ baseUrl: preset.baseUrl, model: preset.model })
                    }
                    disabled={!preset.baseUrl}
                  >
                    {preset.label}
                  </Button>
                );
              })}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rag-baseurl">Base URL</Label>
              <Input
                id="rag-baseurl"
                value={settings.baseUrl}
                onChange={(event) => onChange({ baseUrl: event.target.value })}
                placeholder="https://api.openai.com/v1"
                spellCheck={false}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rag-model">Model</Label>
              <Input
                id="rag-model"
                value={settings.model}
                onChange={(event) => onChange({ model: event.target.value })}
                placeholder="gpt-4o-mini"
                spellCheck={false}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rag-key">API key</Label>
              <Input
                id="rag-key"
                type="password"
                value={settings.apiKey}
                onChange={(event) => onChange({ apiKey: event.target.value })}
                placeholder={keyless ? 'Not needed for a local model' : 'sk-…'}
                spellCheck={false}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Stored in this browser only. It is sent straight to the provider above — never to this app.
              </p>
            </div>
          </div>

          {testResult && (
            <Alert variant={testResult.ok ? 'default' : 'destructive'}>
              {testResult.ok ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <AlertDescription className="text-xs">{testResult.message}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => {
              clearTranslationCache();
              setTestResult({ ok: true, message: 'Cached translations cleared.' });
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Clear cache
          </Button>

          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleTest} disabled={testing}>
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
              <span className="ml-1.5">Test connection</span>
            </Button>
            <Button type="button" size="sm" className="bg-yellow-900 hover:bg-yellow-950" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
