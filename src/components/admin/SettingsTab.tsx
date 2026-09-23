import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { getSetting, saveSetting, testGeminiKey } from '@/lib/admin';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

export function SettingsTab() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    Promise.all([getSetting('gemini_api_key'), getSetting('gemini_model')]).then(([k, m]) => {
      setHasKey(!!k);
      if (m) setModel(m);
    });
  }, []);

  const save = useMutation({
    mutationFn: async () => {
      if (apiKey.trim()) await saveSetting('gemini_api_key', apiKey.trim(), user?.$id);
      if (model.trim()) await saveSetting('gemini_model', model.trim(), user?.$id);
    },
    onSuccess: () => {
      setHasKey(true);
      setApiKey('');
      toast({ title: 'Settings saved', description: 'The Gemini key is stored in the admin-only app_settings table — it never ships in the app bundle.' });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Save failed', description: e.message }),
  });

  const test = async () => {
    setTesting(true);
    try {
      const key = apiKey.trim() || (await getSetting('gemini_api_key'));
      if (!key) throw new Error('No key saved yet.');
      const m = model.trim() || undefined;
      await testGeminiKey(key, m);
      toast({ title: 'Gemini key works', description: `Model ${m || 'gemini-2.0-flash'} is available.` });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Test failed', description: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Gemini API</CardTitle>
          <CardDescription>
            Used by the AI Drafts tab to extract word pairs from images, PDFs and pasted text.
            Get a free key at <a className="underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <ShieldCheck className={`h-4 w-4 ${hasKey ? 'text-green-600' : 'text-muted-foreground'}`} />
            Status: {hasKey === null ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : hasKey ? (
              <Badge className="bg-green-700 hover:bg-green-700">key configured</Badge>
            ) : (
              <Badge variant="secondary">not configured</Badge>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gkey">Gemini API key {hasKey && <span className="text-muted-foreground">(leave blank to keep current)</span>}</Label>
            <Input id="gkey" type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasKey ? '••••••••••••••••' : 'AIza...'} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gmodel">Model (optional)</Label>
            <Input id="gmodel" value={model} onChange={(e) => setModel(e.target.value)} placeholder="gemini-2.0-flash" />
          </div>

          <div className="flex gap-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending || (!apiKey.trim() && !model.trim())}
              className="bg-yellow-900 hover:bg-yellow-950 gap-2">
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
            <Button variant="outline" onClick={test} disabled={testing} className="gap-2">
              {testing && <Loader2 className="h-4 w-4 animate-spin" />}
              Test connection
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How admin access works</CardTitle>
          <CardDescription>
            Admin access &amp; key handling:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 text-sm text-muted-foreground">
            <p>• Access is granted by the <code className="bg-muted px-1 rounded">admin</code> label on your Appwrite account (server-enforced, not just UI hiding).</p>
            <p>• To grant someone else: Appwrite Console → Users → their account → Labels → add <code className="bg-muted px-1 rounded">admin</code>.</p>
            <p>• The Gemini key lives in the private <code className="bg-muted px-1 rounded">app_settings</code> table and is only fetched by labeled admins.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
