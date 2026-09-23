import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Pencil } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { submitCorrection, type WordCorrection } from '@/lib/dictionary';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

const FIELD_OPTIONS: { value: WordCorrection['field']; label: string }[] = [
  { value: 'pronunciation', label: 'Pronunciation / translation' },
  { value: 'definitions', label: 'Definitions' },
  { value: 'example', label: 'Example sentence' },
  { value: 'partOfSpeech', label: 'Part of speech' },
  { value: 'word', label: 'Spelling of the word' },
  { value: 'translation', label: 'Translation' },
  { value: 'other', label: 'Something else' },
];

interface CorrectionDialogProps {
  wordId: string;
  word: string;
  pronunciation: string;
  definitions: string[];
}

export function CorrectionDialog({ wordId, word, pronunciation, definitions }: CorrectionDialogProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const [field, setField] = useState<WordCorrection['field']>('pronunciation');
  const [suggestedValue, setSuggestedValue] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentValue =
    field === 'pronunciation' ? pronunciation
    : field === 'definitions' ? definitions.join(' | ')
    : '';

  const handleSubmit = async () => {
    if (!user || !suggestedValue.trim()) return;
    setSubmitting(true);
    try {
      await submitCorrection(
        { $id: user.$id, name: user.name, profile },
        {
          wordId,
          word,
          field,
          currentValue: currentValue.slice(0, 4000) || undefined,
          suggestedValue: suggestedValue.trim(),
          note: note.trim() || undefined,
        },
      );
      toast({
        title: 'Fix suggested',
        description: `Thanks${profile?.displayName ? `, ${profile.displayName}` : ''}! Your correction of "${word}" will be reviewed.`,
      });
      setSuggestedValue('');
      setNote('');
      setOpen(false);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Could not submit correction',
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          title="Suggest a fix for this word"
          className="text-muted-foreground hover:text-foreground p-1 h-auto"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Suggest a fix for &ldquo;{word}&rdquo;</DialogTitle>
          <DialogDescription>
            Spotted a mistake? Tell us what it should be and a reviewer will take a look.
          </DialogDescription>
        </DialogHeader>

        {!user ? (
          <div className="space-y-3 py-4 text-center">
            <p className="text-sm text-muted-foreground">You need an account to suggest fixes.</p>
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
            <div className="space-y-1.5">
              <Label>What needs fixing?</Label>
              <Select value={field} onValueChange={(v) => setField(v as WordCorrection['field'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_OPTIONS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentValue ? (
                <p className="text-xs text-muted-foreground">Current: <span className="italic">{currentValue || '—'}</span></p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cr-value">What should it be? *</Label>
              <Textarea
                id="cr-value"
                value={suggestedValue}
                onChange={(e) => setSuggestedValue(e.target.value)}
                rows={3}
                maxLength={4000}
                placeholder="The corrected version..."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cr-note">Note (optional)</Label>
              <Textarea
                id="cr-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={2048}
                placeholder="Why is the current version wrong?"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting || !suggestedValue.trim()}
              className="w-full bg-yellow-900 hover:bg-yellow-950 gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              {submitting ? 'Submitting...' : 'Submit correction'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
