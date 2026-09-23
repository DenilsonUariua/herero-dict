import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Trash2, MailOpen, Loader2 } from 'lucide-react';
import { listMessages, setMessageRead, deleteMessage, type MessageRow } from '@/lib/admin';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

export function MessagesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: messages, isLoading } = useQuery({ queryKey: ['admin-messages'], queryFn: listMessages });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-messages'] });

  const markRead = useMutation({
    mutationFn: ({ id, isRead }: { id: string; isRead: boolean }) => setMessageRead(id, isRead),
    onSuccess: invalidate,
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Failed', description: e.message }),
  });

  const remove = useMutation({
    mutationFn: deleteMessage,
    onSuccess: () => { toast({ title: 'Message deleted' }); invalidate(); },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Failed', description: e.message }),
  });

  return (
    <div className="space-y-3">
      {isLoading ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2 py-8 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</p>
      ) : !messages?.length ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">No messages from the contact form yet.</CardContent></Card>
      ) : (
        messages.map((m: MessageRow) => (
          <Card key={m.$id} className={m.isRead ? 'opacity-70' : ''}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {m.name || 'Anonymous'}
                    {!m.isRead && <span className="h-2 w-2 rounded-full bg-yellow-700 inline-block" title="Unread" />}
                  </p>
                  <p className="text-sm mt-1 whitespace-pre-wrap break-words">{m.text}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(m.$createdAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" title={m.isRead ? 'Mark unread' : 'Mark read'}
                    onClick={() => markRead.mutate({ id: m.$id, isRead: !m.isRead })}>
                    <MailOpen className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" title="Delete"
                    onClick={() => remove.mutate(m.$id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
