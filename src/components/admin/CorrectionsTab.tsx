import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X, Loader2, Pencil } from 'lucide-react';
import { listCorrections, applyCorrection, rejectCorrection } from '@/lib/admin';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { StatusBadge } from '@/components/admin/SuggestionsTab';

export function CorrectionsTab() {
  const [statusFilter, setStatusFilter] = useState('pending');
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: corrections, isLoading } = useQuery({
    queryKey: ['admin-corrections', statusFilter],
    queryFn: () => listCorrections(statusFilter),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-corrections'] });
    queryClient.invalidateQueries({ queryKey: ['words'] });
    queryClient.invalidateQueries({ queryKey: ['admin-words'] });
  };

  const approve = useMutation({
    mutationFn: applyCorrection,
    onSuccess: () => {
      toast({ title: 'Fix applied', description: 'The word has been updated.' });
      invalidate();
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Apply failed', description: e.message }),
  });

  const reject = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => rejectCorrection(id, note),
    onSuccess: () => {
      toast({ title: 'Correction rejected' });
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
      ) : !corrections?.length ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">No corrections here.</CardContent></Card>
      ) : (
        corrections.map((c) => (
          <Card key={c.$id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-lg">{c.word || c.wordId.slice(0, 8)}</span>
                    <Badge variant="outline" className="capitalize">{c.field.replace(/([A-Z])/g, ' $1')}</Badge>
                    <StatusBadge status={c.status} />
                  </div>
                  {c.currentValue && (
                    <p className="text-sm text-muted-foreground">
                      Current: <span className="line-through italic">{c.currentValue.slice(0, 200) || '—'}</span>
                    </p>
                  )}
                  <p className="text-sm">
                    Suggested: <span className="font-medium">{c.suggestedValue.slice(0, 300)}</span>
                  </p>
                  {c.note && <p className="text-xs text-muted-foreground">Contributor note: {c.note}</p>}
                  <p className="text-xs text-muted-foreground pt-1">
                    by {c.userName || c.userId.slice(0, 8)} · {new Date(c.$createdAt).toLocaleString()}
                    {c.reviewNote && <> · reviewer: {c.reviewNote}</>}
                  </p>
                </div>
                {c.status === 'pending' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" className="bg-green-700 hover:bg-green-800 gap-1" disabled={approve.isPending}
                      onClick={() => approve.mutate(c)}>
                      {approve.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Apply
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 gap-1"
                      onClick={() => setRejecting(c.$id)}>
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
            <DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4" /> Reject correction</DialogTitle>
            <DialogDescription>Optionally tell the contributor why.</DialogDescription>
          </DialogHeader>
          <Textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} rows={3} maxLength={1024} />
          <Button variant="destructive" className="w-full" disabled={reject.isPending}
            onClick={() => rejecting && reject.mutate({ id: rejecting, note: rejectNote })}>
            {reject.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reject correction'}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
