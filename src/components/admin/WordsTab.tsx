import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import {
  listWords, createWord, updateWord, deleteWord, listAllLanguages, POS_OPTIONS,
  type AdminWord, type WordInput, type WordStatus,
} from '@/lib/admin';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';

export function WordsTab() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<AdminWord | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<AdminWord | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: words, isLoading } = useQuery({
    queryKey: ['admin-words', query],
    queryFn: () => listWords(query),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-words'] });
    queryClient.invalidateQueries({ queryKey: ['words'] });
    queryClient.invalidateQueries({ queryKey: ['like-count'] });
    queryClient.invalidateQueries({ queryKey: ['word-of-the-day'] });
  };

  const remove = useMutation({
    mutationFn: deleteWord,
    onSuccess: () => {
      toast({ title: 'Word deleted' });
      setDeleting(null);
      invalidate();
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Delete failed', description: e.message }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search headwords, press Enter..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setQuery(search)}
          />
        </div>
        {query && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setQuery(''); }}>Clear</Button>
        )}
        <Button className="ml-auto bg-yellow-900 hover:bg-yellow-950 gap-1.5" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Add word
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2 py-8 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</p>
      ) : !words?.length ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">No words found.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {words.map((w) => (
                <div key={w.$id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{w.word}</span>
                      <Badge variant="outline" className="uppercase">{w.languageId}</Badge>
                      {w.status !== 'approved' && <Badge variant="secondary">{w.status}</Badge>}
                      {w.partOfSpeech && <span className="text-xs text-muted-foreground capitalize">{w.partOfSpeech}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {w.pronunciation || ''}{w.definitions?.length ? ` · ${w.definitions.join(' · ').slice(0, 120)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(w)} title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => setDeleting(w)} title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <WordFormDialog
        open={adding || !!editing}
        word={editing}
        onOpenChange={(o) => { if (!o) { setAdding(false); setEditing(null); } }}
        onSaved={() => { setAdding(false); setEditing(null); invalidate(); }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.word}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the word and its translation links. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" disabled={remove.isPending}
              onClick={(e) => { e.preventDefault(); deleting && remove.mutate(deleting.$id); }}>
              {remove.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function WordFormDialog({ open, word, onOpenChange, onSaved }: {
  open: boolean;
  word: AdminWord | null;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const isEdit = !!word;
  const { toast } = useToast();
  const { data: languages } = useQuery({ queryKey: ['languages'], queryFn: listAllLanguages, staleTime: Infinity });

  const [languageId, setLanguageId] = useState('en');
  const [wordText, setWordText] = useState('');
  const [pronunciation, setPronunciation] = useState('');
  const [definitions, setDefinitions] = useState('');
  const [example, setExample] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState('other');
  const [status, setStatus] = useState<WordStatus>('approved');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setLanguageId(word?.languageId ?? 'en');
      setWordText(word?.word ?? '');
      setPronunciation(word?.pronunciation ?? '');
      setDefinitions(word?.definitions?.join('\n') ?? '');
      setExample(word?.example ?? '');
      setPartOfSpeech(word?.partOfSpeech ?? 'other');
      setStatus(word?.status ?? 'approved');
    }
  }, [open, word]);

  const handleSave = async () => {
    if (!wordText.trim()) return;
    setSaving(true);
    const payload: WordInput = {
      languageId,
      word: wordText.trim(),
      pronunciation: pronunciation.trim() || undefined,
      definitions: definitions.trim() ? definitions.split('\n').map((d) => d.trim()).filter(Boolean) : undefined,
      example: example.trim() || undefined,
      partOfSpeech,
      status,
    };
    try {
      if (isEdit && word) await updateWord(word.$id, payload);
      else await createWord(payload);
      toast({ title: isEdit ? 'Word updated' : 'Word added' });
      onSaved();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Save failed', description: e instanceof Error ? e.message : 'Try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit “${word?.word}”` : 'Add a new word'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Language</Label>
              <Select value={languageId} onValueChange={setLanguageId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(languages ?? []).map((l) => <SelectItem key={l.$id} value={l.code}>{l.name} ({l.code})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Part of speech</Label>
              <Select value={partOfSpeech} onValueChange={setPartOfSpeech}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {POS_OPTIONS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Word *</Label>
            <Input value={wordText} onChange={(e) => setWordText(e.target.value)} maxLength={256} />
          </div>
          <div className="space-y-1.5">
            <Label>Pronunciation / translation</Label>
            <Input value={pronunciation} onChange={(e) => setPronunciation(e.target.value)} maxLength={512} />
          </div>
          <div className="space-y-1.5">
            <Label>Definitions (one per line)</Label>
            <Textarea value={definitions} onChange={(e) => setDefinitions(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Example</Label>
              <Input value={example} onChange={(e) => setExample(e.target.value)} maxLength={1024} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as WordStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">approved</SelectItem>
                  <SelectItem value="pending">pending</SelectItem>
                  <SelectItem value="archived">archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving || !wordText.trim()} className="w-full bg-yellow-900 hover:bg-yellow-950 gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Add word'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
