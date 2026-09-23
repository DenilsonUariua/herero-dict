import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Loader2, Search, Trash2 } from 'lucide-react';
import { listWotd, setWotd, deleteWotd, listWords, type AdminWord } from '@/lib/admin';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

export function WotdTab() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<AdminWord | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rows, isLoading } = useQuery({ queryKey: ['admin-wotd'], queryFn: listWotd });
  const { data: results } = useQuery({
    queryKey: ['admin-wotd-search', query],
    queryFn: () => listWords(query, 10),
    enabled: query.trim().length > 0,
  });

  const save = useMutation({
    mutationFn: () => setWotd(date, picked!.$id, picked!.languageId, undefined, picked!.word),
    onSuccess: () => {
      toast({ title: 'Word of the Day set', description: `${date}: ${picked!.word}` });
      queryClient.invalidateQueries({ queryKey: ['admin-wotd'] });
      queryClient.invalidateQueries({ queryKey: ['word-of-the-day'] });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Failed', description: e.message }),
  });

  const remove = useMutation({
    mutationFn: deleteWotd,
    onSuccess: () => {
      toast({ title: 'Entry removed' });
      queryClient.invalidateQueries({ queryKey: ['admin-wotd'] });
      queryClient.invalidateQueries({ queryKey: ['word-of-the-day'] });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="wotd-date">Date</Label>
              <Input id="wotd-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label>Pick a word</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Search headwords, press Enter..."
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { setQuery(search); setPicked(null); } }} />
              </div>
            </div>
          </div>

          {!!results?.length && (
            <div className="rounded-md border divide-y max-h-56 overflow-y-auto">
              {results.map((w) => (
                <button key={w.$id} onClick={() => setPicked(w)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-muted/60 ${picked?.$id === w.$id ? 'bg-yellow-50' : ''}`}>
                  <span className="font-medium">{w.word}</span>
                  <span className="text-xs uppercase text-muted-foreground">{w.languageId}</span>
                  <span className="text-xs text-muted-foreground truncate">{w.pronunciation || w.definitions?.[0] || ''}</span>
                </button>
              ))}
            </div>
          )}

          {picked && (
            <p className="text-sm">Selected: <span className="font-semibold">{picked.word}</span> for <span className="font-semibold">{date}</span></p>
          )}

          <Button disabled={!picked || save.isPending} onClick={() => save.mutate()}
            className="bg-yellow-900 hover:bg-yellow-950 gap-2">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
            Set Word of the Day
          </Button>
        </CardContent>
      </Card>

      <div>
        <h2 className="font-semibold mb-3">Scheduled entries</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</p>
        ) : !rows?.length ? (
          <p className="text-sm text-muted-foreground">No curated entries. The homepage falls back to a daily rotating word.</p>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {rows.map((r) => (
                  <div key={r.$id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="font-mono text-sm">{r.date}</span>
                    <span className="text-sm flex-1 truncate">{r.word || r.wordId.slice(0, 10) + '…'}{r.note ? <span className="text-muted-foreground"> · {r.note}</span> : null}</span>
                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => remove.mutate(String(r.date))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
