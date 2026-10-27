import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '@/lib/clipboard';

interface CopyButtonProps {
  /** Text put on the clipboard. */
  value: string;
  /** Visible text and, unless `ariaLabel` is given, the accessible name. */
  label?: string;
  /** Longer accessible name / tooltip when the visible label is short. */
  ariaLabel?: string;
  /** Toast shown after a successful copy. */
  successMessage?: string;
  /** Render the text next to the icon. */
  showLabel?: boolean;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
}

export function CopyButton({
  value,
  label = 'Copy',
  ariaLabel,
  successMessage = 'Copied to clipboard',
  showLabel = false,
  variant = 'ghost',
  size = 'sm',
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const handleCopy = useCallback(
    async (event: React.MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
      const ok = await copyToClipboard(value);
      if (!ok) {
        toast.error('Could not copy', { description: 'Select the text and copy it manually.' });
        return;
      }
      setCopied(true);
      toast.success(successMessage, { duration: 1600 });
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    },
    [value, successMessage],
  );

  return (
    <Button
      type="button"
      variant={variant}
      size={showLabel ? size : 'icon'}
      onClick={handleCopy}
      title={ariaLabel ?? label}
      aria-label={ariaLabel ?? label}
      className={cn(showLabel ? 'gap-1.5' : 'h-8 w-8', className)}
    >
      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
      {showLabel && <span>{copied ? 'Copied' : label}</span>}
    </Button>
  );
}
