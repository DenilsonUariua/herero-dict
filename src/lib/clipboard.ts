/**
 * Clipboard helper.
 *
 * `navigator.clipboard` only exists in secure contexts (https / localhost), so
 * a plain `navigator.clipboard.writeText()` silently fails for anyone opening
 * the site over http:// or inside an in-app webview — exactly the situation a
 * lot of WhatsApp traffic arrives in. The legacy textarea + execCommand path
 * covers those cases.
 */

export async function copyToClipboard(value: string): Promise<boolean> {
  const text = value ?? '';
  if (!text.trim()) return false;

  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // permission denied or the document was not focused — try the old path
    }
  }

  return legacyCopy(text);
}

function legacyCopy(text: string): boolean {
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '0';
    area.style.left = '0';
    area.style.width = '1px';
    area.style.height = '1px';
    area.style.padding = '0';
    area.style.border = 'none';
    area.style.opacity = '0';
    document.body.appendChild(area);

    const selection = document.getSelection();
    const previousRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    area.focus();
    area.select();
    // iOS ignores select() on readonly textareas without an explicit range
    area.setSelectionRange(0, text.length);

    const ok = document.execCommand('copy');
    document.body.removeChild(area);

    if (previousRange && selection) {
      selection.removeAllRanges();
      selection.addRange(previousRange);
    }
    return ok;
  } catch {
    return false;
  }
}
