import { useCallback } from 'react';
import { MessageCircle, Send, Share2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Button, type ButtonProps } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '@/lib/clipboard';
import {
  canNativeShare,
  nativeShare,
  openExternal,
  smsUrl,
  telegramUrl,
  whatsappUrl,
  type SharePayload,
} from '@/lib/share';

interface ShareMenuProps extends SharePayload {
  /** Accessible name for the trigger. */
  label?: string;
  showLabel?: boolean;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
  align?: 'start' | 'center' | 'end';
}

/**
 * Share a word or a translated sentence into a chat.
 *
 * Order matters: on a phone the native sheet is one tap and reaches every
 * installed app, so it comes first; the explicit WhatsApp/Telegram links are
 * the fallback for desktop browsers that do not implement Web Share.
 */
export function ShareMenu({
  text,
  url,
  label = 'Share',
  showLabel = false,
  variant = 'ghost',
  size = 'sm',
  className,
  align = 'end',
}: ShareMenuProps) {
  const handleNative = useCallback(async () => {
    const shared = await nativeShare({ text, url });
    if (!shared && !canNativeShare()) {
      toast.error('Sharing is not available in this browser', {
        description: 'Use WhatsApp or copy the text instead.',
      });
    }
  }, [text, url]);

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(url ? `${text}\n${url}` : text);
    if (ok) toast.success('Copied to clipboard', { duration: 1600 });
    else toast.error('Could not copy', { description: 'Select the text and copy it manually.' });
  }, [text, url]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={showLabel ? size : 'icon'}
          title={label}
          aria-label={label}
          className={cn(showLabel ? 'gap-1.5' : 'h-8 w-8', className)}
        >
          <Share2 className="h-4 w-4" />
          {showLabel && <span>Share</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-52">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          Send to
        </DropdownMenuLabel>
        {canNativeShare() && (
          <DropdownMenuItem className="gap-2" onSelect={handleNative}>
            <Smartphone className="h-4 w-4" /> Share to an app…
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="gap-2"
          onSelect={() => openExternal(whatsappUrl({ text, url }))}
        >
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2"
          onSelect={() => openExternal(telegramUrl({ text, url }))}
        >
          <Send className="h-4 w-4" /> Telegram
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2"
          onSelect={() => {
            window.location.href = smsUrl({ text, url });
          }}
        >
          <Smartphone className="h-4 w-4" /> SMS
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2" onSelect={handleCopy}>
          Copy text
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
