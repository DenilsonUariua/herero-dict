import React, { useState, useEffect } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { tables, ID } from '@/lib/appwrite';
import { envConfigs } from '@/configs/env-configs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const HINT_KEY = 'herero_message_hint_shown';

const MessagePopup = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showHint, setShowHint] = useState(false);

  // A one-off nudge is enough — a bubble that keeps bouncing back over the
  // cards is the kind of thing people install ad blockers for.
  useEffect(() => {
    let shown = false;
    try {
      shown = sessionStorage.getItem(HINT_KEY) === '1';
    } catch {
      shown = true;
    }
    if (shown) return;

    const timer = setTimeout(() => {
      setShowHint(true);
      try {
        sessionStorage.setItem(HINT_KEY, '1');
      } catch {
        /* private mode */
      }
      setTimeout(() => setShowHint(false), 6000);
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async () => {
    if (!message.trim()) {
      setError('Please enter a message');
      return;
    }

    setSending(true);
    setError('');

    try {
      await tables.createRow(envConfigs.appwriteDatabaseId, envConfigs.appwriteMessagesTableId, ID.unique(), {
        name: name,
        text: message,
      });

      setSuccess(true);
      setMessage('');
      setName('');
      setTimeout(() => {
        setSuccess(false);
        setIsOpen(false);
      }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) handleSubmit();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        setShowHint(false);
        if (!open) {
          setSuccess(false);
          setError('');
        }
      }}
    >
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 sm:bottom-6 sm:right-6">
        {showHint && !isOpen && (
          <div className="animate-fade-in rounded-lg bg-yellow-900 px-3 py-2 text-xs text-white shadow-lg">
            Missing a word? Tell us.
          </div>
        )}
        <DialogTrigger asChild>
          <button
            type="button"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-yellow-900 text-white shadow-lg transition-transform hover:scale-105 hover:bg-yellow-950"
            aria-label="Send us a message or suggest a word"
          >
            <MessageCircle size={24} />
          </button>
        </DialogTrigger>
      </div>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send us a message</DialogTitle>
          <DialogDescription>
            Missing a word, or spotted a mistake? Tell us and we will fix it.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <p className="text-base font-semibold text-emerald-700">Message sent</p>
            <p className="mt-1 text-sm text-muted-foreground">Thank you for helping the dictionary grow.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="message-name">Name (optional)</Label>
              <Input
                id="message-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                maxLength={255}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="message-text">
                Message <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="message-text"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Have a word suggestion? Send it here and we will add it."
                rows={4}
                className="resize-none"
                maxLength={3000}
              />
              <p className="text-right text-[11px] text-muted-foreground">{message.length}/3000</p>
            </div>

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            )}

            <Button
              onClick={handleSubmit}
              disabled={sending || !message.trim()}
              className="w-full gap-2 bg-yellow-900 hover:bg-yellow-950"
            >
              {sending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Sending…
                </>
              ) : (
                <>
                  <Send size={16} />
                  Send message
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MessagePopup;
