/**
 * Sharing helpers.
 *
 * The audience for this dictionary lives in WhatsApp and Messenger, so a
 * "copy" that only puts plain text on the clipboard is not enough — people
 * want the text to land in a chat. Two routes:
 *
 *  - `navigator.share` opens the OS share sheet (WhatsApp, Messenger, Signal,
 *    Telegram, SMS…) on phones that support it.
 *  - explicit `wa.me` / `t.me` / `sms:` links cover desktop and older browsers.
 *
 * Everything is plain text with no markdown, because chat apps do not render
 * it and asterisks just look like noise in a message.
 */

export interface SharePayload {
  /** The message body, already formatted for a chat. */
  text: string;
  /** Optional page link appended after the text. */
  url?: string;
}

const BRAND = 'Otjiherero Dictionary';

/** The site origin at runtime, so previews and production links both work. */
export function siteUrl(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

export function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export async function nativeShare({ text, url }: SharePayload): Promise<boolean> {
  if (!canNativeShare()) return false;
  try {
    await navigator.share({
      title: BRAND,
      text,
      ...(url ? { url } : {}),
    });
    return true;
  } catch (err) {
    // AbortError = the user dismissed the sheet; not a failure worth reporting
    if ((err as Error)?.name === 'AbortError') return false;
    return false;
  }
}

export function whatsappUrl({ text, url }: SharePayload): string {
  const body = url ? `${text}\n${url}` : text;
  return `https://wa.me/?text=${encodeURIComponent(body)}`;
}

export function telegramUrl({ text, url }: SharePayload): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url ?? siteUrl())}&text=${encodeURIComponent(text)}`;
}

export function smsUrl({ text }: SharePayload): string {
  // iOS wants `sms:&body=`, Android accepts `sms:?body=`
  return `sms:?&body=${encodeURIComponent(text)}`;
}

export function mailtoUrl({ text, url }: SharePayload): string {
  const body = url ? `${text}\n\n${url}` : text;
  return `mailto:?subject=${encodeURIComponent(BRAND)}&body=${encodeURIComponent(body)}`;
}

/** Open a share target without handing the opener a window reference. */
export function openExternal(href: string): void {
  window.open(href, '_blank', 'noopener,noreferrer');
}

/** `word — translation`, the format people actually paste into a chat. */
export function formatWordShare(english: string, herero: string): string {
  const en = (english ?? '').trim();
  const hz = (herero ?? '').trim();
  if (en && hz) return `${en} — ${hz}`;
  return en || hz;
}

/** Sentence plus an optional back-translation, for sharing a full translation. */
export function formatSentenceShare(primary: string, secondary?: string | null): string {
  const main = (primary ?? '').trim();
  const back = (secondary ?? '').trim();
  if (main && back && back.toLowerCase() !== main.toLowerCase()) return `${main}\n(${back})`;
  return main;
}
