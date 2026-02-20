/**
 * Clipboard utility with async Clipboard API and execCommand fallback.
 *
 * @module clipboard
 */

/**
 * Copy text to the clipboard.
 *
 * Tries the modern async Clipboard API first. If that fails (e.g. in older
 * browsers or contexts without clipboard-write permission), falls back to
 * the legacy document.execCommand('copy') approach using a hidden textarea.
 *
 * @param text - The text to copy
 * @returns true if the copy succeeded, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback: hidden textarea + execCommand
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const result = document.execCommand('copy');
      document.body.removeChild(textarea);
      return result;
    } catch {
      return false;
    }
  }
}
