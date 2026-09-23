import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, FileImage, Sparkles, Loader2, Upload, Trash2, Check, Eye,
} from 'lucide-react';
import {
  listDrafts, saveDraft, discardDraft, approveDraftEntries, getSetting, extractWithGemini,
  type DraftEntry, type WordDraft,
} from '@/lib/admin';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { StatusBadge } from '@/components/admin/SuggestionsTab';

const MAX_FILE_BYTES = 15 * 1024 * 1024; // ~15MB inline limit for Gemini

export function DraftsTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [inputType, setInputType] = useState<'image' | 'pdf' | 'text'>('text');
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [extracted, setExtracted] = useState<DraftEntry[] | null>(null);
  const [reviewing, setReviewing] = useState<WordDraft | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: drafts, isLoading } = useQuery({ queryKey: ['admin-drafts'], queryFn: listDrafts });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-drafts'] });
    queryClient.invalidateQueries({ queryKey: ['admin-words'] });
    queryClient.invalidateQueries({ queryKey: ['words'] });
  };

  const acceptFile = (f: File | null | undefined) => {
    if (!f) return;
    const isImage = f.type.startsWith('image/');
    const isPdf = f.type === 'application/pdf';
    if (inputType === 'image' && !isImage) { toast({ variant: 'destructive', description: 'Please choose an image (png, jpg, webp).' }); return; }
    if (inputType === 'pdf' && !isPdf) { toast({ variant: 'destructive', description: 'Please choose a PDF.' }); return; }
    if (f.size > MAX_FILE_BYTES) { toast({ variant: 'destructive', description: 'File too large (max ~15MB).' }); return; }
    setFile(f);
    setExtractError('');
  };

  const extract = async () => {
    setExtractError('');
    const apiKey = await getSetting('gemini_api_key');
    if (!apiKey) {
      setExtractError('No Gemini API key configured. Add it in the Settings tab first.');
      return;
    }
    setExtracting(true);
    try {
      if (inputType === 'text') {
        if (!pastedText.trim()) throw new Error('Paste some text first.');
        const { entries, model } = await extractWithGemini({ apiKey, sourceType: 'text', text: pastedText });
        setExtracted(entries);
        if (entries.length) {
          await saveDraft({ sourceType: 'text', sourceName: `pasted ${new Date().toLocaleString()}`, model, entries, rawPreview: pastedText.slice(0, 4000), createdBy: user?.$id });
          toast({ title: 'Extraction complete', description: `${entries.length} entries saved as a private draft — approve it below to publish.` });
        } else {
          setExtractError('No word pairs were found in the text.');
        }
      } else {
        if (!file) throw new Error('Choose a file first.');
        const base64 = await fileToBase64(file);
        const mime = file.type === 'application/pdf' ? 'application/pdf' : file.type;
        const { entries, model } = await extractWithGemini({ apiKey, sourceType: inputType, mimeType: mime, base64Data: base64 });
        setExtracted(entries);
        if (entries.length) {
          await saveDraft({ sourceType: inputType, sourceName: file.name, model, entries, rawPreview: `${file.name} (${(file.size / 1024).toFixed(0)} KB)`, createdBy: user?.$id });
          toast({ title: 'Extraction complete', description: `${entries.length} entries saved as a private draft — approve it below to publish.` });
        } else {
          setExtractError('No word pairs were found in the file.');
        }
      }
      invalidate();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Extraction failed.';
      setExtractError(msg);
      // store the failed attempt so there is a trace
      try {
        await saveDraft({
          sourceType: inputType,
          sourceName: inputType === 'text' ? 'pasted text' : file?.name,
          entries: [],
          rawPreview: inputType === 'text' ? pastedText.slice(0, 2000) : file?.name,
          error: msg.slice(0, 2000),
          createdBy: user?.$id,
        });
        invalidate();
      } catch { /* ignore */ }
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* extractor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-yellow-700" /> Import words with Gemini AI</CardTitle>
          <CardDescription>
            Drop an image or PDF of a word list (or paste text). Gemini extracts Herero–English pairs into a draft.
            Drafts are private — nothing goes live until you approve it below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={inputType} onValueChange={(v) => { setInputType(v as typeof inputType); setFile(null); setExtractError(''); }}>
            <TabsList>
              <TabsTrigger value="text" className="gap-1.5"><FileText className="h-4 w-4" /> Paste text</TabsTrigger>
              <TabsTrigger value="image" className="gap-1.5"><FileImage className="h-4 w-4" /> Image</TabsTrigger>
              <TabsTrigger value="pdf" className="gap-1.5"><FileText className="h-4 w-4" /> PDF</TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="pt-3">
              <Textarea
                rows={7}
                placeholder={'Paste vocab lists, tables or plain text, e.g.:\n\nomutwe — head\novyepo — lungs\nongombe I, cattle...'}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
              />
            </TabsContent>

            <TabsContent value="image" className="pt-3">
              <DropZone accept="image/*" file={file} dragOver={dragOver} inputRef={fileInputRef}
                onDragOver={() => setDragOver(true)} onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { setDragOver(false); acceptFile(e.dataTransfer.files?.[0]); }}
                onPick={() => fileInputRef.current?.click()} />
            </TabsContent>

            <TabsContent value="pdf" className="pt-3">
              <DropZone accept="application/pdf" file={file} dragOver={dragOver} inputRef={fileInputRef}
                onDragOver={() => setDragOver(true)} onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { setDragOver(false); acceptFile(e.dataTransfer.files?.[0]); }}
                onPick={() => fileInputRef.current?.click()} />
            </TabsContent>
          </Tabs>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={inputType === 'image' ? 'image/png,image/jpeg,image/webp' : 'application/pdf'}
            onChange={(e) => acceptFile(e.target.files?.[0])}
          />

          {extractError && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{extractError}</p>}

          <Button onClick={extract} disabled={extracting || (inputType === 'text' ? !pastedText.trim() : !file)}
            className="w-full sm:w-auto bg-yellow-900 hover:bg-yellow-950 gap-2">
            {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {extracting ? 'Extracting with Gemini...' : 'Extract word pairs'}
          </Button>
        </CardContent>
      </Card>

      {/* drafts list */}
      <div>
        <h2 className="font-semibold mb-3">Drafts <span className="text-muted-foreground font-normal text-sm">(private until approved)</span></h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2 py-6 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</p>
        ) : !drafts?.length ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No drafts yet.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {drafts.map((d) => (
              <Card key={d.$id}>
                <CardContent className="p-4 flex items-center gap-3">
                  <Badge variant="outline" className="uppercase shrink-0">{d.sourceType}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{d.sourceName || 'Untitled source'}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.entryCount ?? 0} entr{(d.entryCount ?? 0) === 1 ? 'y' : 'ies'}
                      {d.model && <> · {d.model}</>}
                      {' · '}{new Date(d.$createdAt).toLocaleString()}
                      {d.error && <> · <span className="text-red-600">error: {d.error.slice(0, 80)}</span></>}
                    </p>
                  </div>
                  <StatusBadge status={d.status} />
                  {d.status === 'pending' && (d.entryCount ?? 0) > 0 && (
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setReviewing(d)}>
                      <Eye className="h-4 w-4" /> Review
                    </Button>
                  )}
                  {d.status === 'pending' && (
                    <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" title="Discard draft"
                      onClick={async () => { await discardDraft(d.$id); invalidate(); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {reviewing && (
        <DraftReviewDialog
          draft={reviewing}
          onClose={() => setReviewing(null)}
          onApproved={() => { setReviewing(null); invalidate(); }}
        />
      )}
    </div>
  );
}

function DropZone({ accept, file, dragOver, inputRef, onDragOver, onDragLeave, onDrop, onPick }: {
  accept: string;
  file: File | null;
  dragOver: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onPick: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPick}
      onKeyDown={(e) => e.key === 'Enter' && onPick()}
      onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
        dragOver ? 'border-yellow-700 bg-yellow-50' : 'border-border hover:bg-muted/50'
      }`}
    >
      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
      {file ? (
        <p className="text-sm font-medium">{file.name} <span className="text-muted-foreground">({(file.size / 1024).toFixed(0)} KB)</span></p>
      ) : (
        <p className="text-sm text-muted-foreground">Drag & drop a file here, or click to browse ({accept.replace(/\//g, ' / ')})</p>
      )}
      <input ref={inputRef} type="file" className="hidden" accept={accept} onClick={(e) => e.stopPropagation()}
        onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) onDrop({ dataTransfer: { files: [f] } } as unknown as React.DragEvent); }} />
    </div>
  );
}

function DraftReviewDialog({ draft, onClose, onApproved }: {
  draft: WordDraft;
  onClose: () => void;
  onApproved: () => void;
}) {
  const entries: DraftEntry[] = JSON.parse(draft.entriesJson || '[]');
  const [selected, setSelected] = useState<Set<number>>(new Set(entries.map((_, i) => i)));
  const [approving, setApproving] = useState(false);
  const { toast } = useToast();

  const toggle = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const approve = async () => {
    setApproving(true);
    try {
      const chosen = entries.filter((_, i) => selected.has(i));
      const { created, linked } = await approveDraftEntries(draft, chosen);
      toast({
        title: 'Draft approved',
        description: `${created} new word entries created, ${linked} linked to existing words. They are now live.`,
      });
      onApproved();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Approval failed', description: e instanceof Error ? e.message : 'Try again.' });
    } finally {
      setApproving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review draft — {draft.sourceName}</DialogTitle>
          <DialogDescription>
            Tick the entries you want to publish. Existing words are linked instead of duplicated.
            Nothing is public until you approve.
          </DialogDescription>
        </DialogHeader>
        <div className="divide-y rounded-md border">
          {entries.map((e, i) => (
            <label key={i} className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50">
              <Checkbox checked={selected.has(i)} onCheckedChange={() => toggle(i)} className="mt-1" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{e.herero}
                  <span className="text-muted-foreground font-normal"> — {e.english}</span>
                  {e.partOfSpeech && <Badge variant="secondary" className="ml-2 capitalize">{e.partOfSpeech}</Badge>}
                </p>
                {e.hereroPronunciation && <p className="text-xs font-mono italic text-muted-foreground">{e.hereroPronunciation}</p>}
                {e.englishDefinition && <p className="text-xs text-muted-foreground">{e.englishDefinition}</p>}
                {e.example && <p className="text-xs italic text-muted-foreground">“{e.example}”</p>}
              </div>
            </label>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground mr-auto">{selected.size} of {entries.length} selected</p>
          <Button variant="ghost" onClick={() => setSelected(new Set(entries.map((_, i) => i)))}>Select all</Button>
          <Button variant="ghost" onClick={() => setSelected(new Set())}>None</Button>
          <Button onClick={approve} disabled={approving || selected.size === 0} className="bg-green-700 hover:bg-green-800 gap-2">
            {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Approve {selected.size || ''}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}
