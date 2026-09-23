import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Loader2, Send } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { fetchLanguages, submitSuggestion } from '@/lib/dictionary';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

const POS_OPTIONS = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'interjection', 'phrase', 'other'];

interface SuggestWordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SuggestWordDialog({ open, onOpenChange }: SuggestWordDialogProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const { data: languages } = useQuery({
    queryKey: ['languages'],
    queryFn: fetchLanguages,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const [languageId, setLanguageId] = useState('hz');
  const [word, setWord] = useState('');
  const [pronunciation, setPronunciation] = useState('');
  const [translation, setTranslation] = useState('');
  const [definitions, setDefinitions] = useState('');
  const [example, setExample] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState<string>('other');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setWord(''); setPronunciation(''); setTranslation(''); setDefinitions('');
    setExample(''); setPartOfSpeech('other'); setNotes('');
  };

  const handleSubmit = async () => {
    if (!word.trim() || !user) return;
    setSubmitting(true);
    try {
      await submitSuggestion(
        { $id: user.$id, name: user.name, profile },
        {
          languageId,
          word: word.trim(),
          pronunciation: pronunciation.trim() || undefined,
          translation: translation.trim() || undefined,
          definitions: definitions.trim() ? definitions.split('\n').map((d) => d.trim()).filter(Boolean) : undefined,
          example: example.trim() || undefined,
          partOfSpeech,
          notes: notes.trim() || undefined,
        },
      );
      toast({
        title: 'Suggestion submitted',
        description: `Thanks${profile?.displayName ? `, ${profile.displayName}` : ''}! "${word.trim()}" will be reviewed.`,
      });
      reset();
      onOpenChange(false);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Could not submit suggestion',
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Suggest a word</DialogTitle>
          <DialogDescription>
            Know a word that&apos;s missing? Submit it and a reviewer will add it to the dictionary.
          </DialogDescription>
        </DialogHeader>

        {!user ? (
          <div className="space-y-3 py-4 text-center">
            <p className="text-sm text-muted-foreground">You need an account to suggest words.</p>
            <div className="flex items-center justify-center gap-2">
              <Button asChild className="bg-yellow-900 hover:bg-yellow-950">
                <Link to="/login">Log in</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/register">Create account</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Language</Label>
                <Select value={languageId} onValueChange={setLanguageId}>
                  <SelectTrigger><SelectValue placeholder="Language" /></SelectTrigger>
                  <SelectContent>
                    {(languages ?? []).map((l) => (
                      <SelectItem key={l.$id} value={l.code}>{l.nativeName || l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Part of speech</Label>
                <Select value={partOfSpeech} onValueChange={setPartOfSpeech}>
                  <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    {POS_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sg-word">Word *</Label>
              <Input id="sg-word" value={word} onChange={(e) => setWord(e.target.value)} maxLength={256} placeholder="e.g. otjimbare" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sg-pron">Pronunciation</Label>
                <Input id="sg-pron" value={pronunciation} onChange={(e) => setPronunciation(e.target.value)} maxLength={512} placeholder="/o-tji-mba-re/" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sg-trans">Meaning / translation</Label>
                <Input id="sg-trans" value={translation} onChange={(e) => setTranslation(e.target.value)} maxLength={512} placeholder="e.g. cattle" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sg-defs">Definitions (one per line)</Label>
              <Textarea id="sg-defs" value={definitions} onChange={(e) => setDefinitions(e.target.value)} rows={3} maxLength={4000} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sg-example">Example sentence</Label>
              <Input id="sg-example" value={example} onChange={(e) => setExample(e.target.value)} maxLength={1024} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sg-notes">Notes for the reviewer</Label>
              <Textarea id="sg-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2048} placeholder="Where did you learn this word? Any context helps." />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting || !word.trim()}
              className="w-full bg-yellow-900 hover:bg-yellow-950 gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {submitting ? 'Submitting...' : 'Submit suggestion'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
