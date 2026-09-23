import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X, Loader2, Lightbulb } from 'lucide-react';
import {
  listSuggestions, promoteSuggestion, rejectSuggestion,
} from '@/lib/admin';
import {
  Card, CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';

export function SuggestionsTab() {
  const [statusFilter, setStatusFilter] = useState('pending');
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['admin-suggestions', statusFilter],
    queryFn: () => listSuggestions(statusFilter),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-suggestions'] });
    queryClient.invalidateQueries({ queryKey: ['words'] });
  };

  const approve = useMutation({
    mutationFn: promoteSuggestion,
    onSuccess: (wordId) => {
      toast({ title: 'Suggestion approved', description: `Added to the dictionary (${wordId.slice(0, 8)}…).` });
      invalidate();
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Approval failed', description: e.message }),
  });

  const reject = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => rejectSuggestion(id, note),
    onSuccess: () => {
      toast({ title: 'Suggestion rejected' });
      setRejecting(null);
      setRejectNote('');
      invalidate();
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Failed', description: e.message }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Status:</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2 py-8 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</p>
      ) : !suggestions?.length ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">No suggestions here.</CardContent></Card>
      ) : (
        suggestions.map((s) => (
          <Card key={s.$id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-lg">{s.word}</span>
                    <Badge variant="outline" className="uppercase">{s.languageId}</Badge>
                    {s.partOfSpeech && <Badge variant="secondary" className="capitalize">{s.partOfSpeech}</Badge>}
                    <StatusBadge status={s.status} />
                  </div>
                  {s.pronunciation && <p className="text-sm font-mono italic text-muted-foreground">{s.pronunciation}</p>}
                  {s.translation && <p className="text-sm">Meaning: <span className="font-medium">{s.translation}</span></p>}
                  {!!s.definitions?.length && <p className="text-sm text-muted-foreground">{s.definitions.join(' · ')}</p>}
                  {s.example && <p className="text-sm italic text-muted-foreground">“{s.example}”</p>}
                  {s.notes && <p className="text-xs text-muted-foreground">Notes: {s.notes}</p>}
                  <p className="text-xs text-muted-foreground pt-1">
                    by {s.userName || s.userId.slice(0, 8)} · {new Date(s.$createdAt).toLocaleString()}
                    {s.createdWordId && <> · created word {s.createdWordId.slice(0, 8)}…</>}
                    {s.reviewNote && <> · reviewer: {s.reviewNote}</>}
                  </p>
                </div>
                {s.status === 'pending' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" className="bg-green-700 hover:bg-green-800 gap-1" disabled={approve.isPending}
                      onClick={() => approve.mutate(s)}>
                      {approve.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 gap-1"
                      onClick={() => setRejecting(s.$id)}>
                      <X className="h-4 w-4" /> Reject
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Lightbulb className="h-4 w-4" /> Reject suggestion</DialogTitle>
            <DialogDescription>Optionally tell the contributor why (visible on their profile).</DialogDescription>
          </DialogHeader>
          <Textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} rows={3} maxLength={1024} placeholder="e.g. duplicate of an existing word" />
          <Button variant="destructive" className="w-full" disabled={reject.isPending}
            onClick={() => rejecting && reject.mutate({ id: rejecting, note: rejectNote })}>
            {reject.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reject suggestion'}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const variant = status === 'approved' ? 'default' : status === 'rejected' || status === 'discarded' ? 'destructive' : 'secondary';
  return <Badge variant={variant} className="capitalize">{status}</Badge>;
}
