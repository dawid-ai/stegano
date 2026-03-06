/**
 * Inline decrypt prompt for encrypted highlights on scanned pages.
 *
 * When a user clicks an encrypted highlight, a Shadow DOM password prompt
 * appears anchored below it. The user enters a password (or selects a saved
 * one from a dropdown), and on success the decrypted text replaces the
 * highlight. On failure, an error appears and retry is possible.
 *
 * NOTE: The MutationObserver in content.ts should skip elements with
 * data-iu-decrypt-prompt to avoid re-scanning prompt DOM nodes.
 *
 * @module decrypt-prompt
 */

import { decodeTagsRun } from '@/utils/scanner';
import { detectEncrypted } from '@/utils/markers';
import { decrypt, DecryptionError } from '@/utils/crypto';
import { passwordsSetting } from '@/utils/storage';

// ---------------------------------------------------------------------------
// Styles for the Shadow DOM prompt
// ---------------------------------------------------------------------------

const PROMPT_STYLES = `
:host {
  all: initial;
  font-family: system-ui, sans-serif;
  font-size: 13px;
}

.prompt-container {
  background: #1e1e1e;
  color: #fff;
  border: 1px solid #444;
  border-radius: 6px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 220px;
  max-width: 320px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

input[type="password"] {
  background: #2a2a2a;
  color: #fff;
  border: 1px solid #555;
  border-radius: 4px;
  padding: 5px 8px;
  font-size: 13px;
  outline: none;
  width: 100%;
  box-sizing: border-box;
}

input[type="password"]:focus {
  border-color: #888;
}

select {
  background: #2a2a2a;
  color: #fff;
  border: 1px solid #555;
  border-radius: 4px;
  padding: 5px 8px;
  font-size: 13px;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  cursor: pointer;
}

button {
  background: #00BCD4;
  color: #000;
  border: none;
  border-radius: 4px;
  padding: 5px 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

button:hover:not(:disabled) {
  background: #00ACC1;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: #EF5350;
  font-size: 12px;
  display: none;
}

.error.visible {
  display: block;
}
`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Attach click handlers to all encrypted highlight spans that haven't been
 * bound yet. Safe to call multiple times (idempotent via data attribute).
 */
export function attachEncryptedClickHandlers(): void {
  const spans = document.querySelectorAll<HTMLElement>(
    '[data-iu-type="encrypted"]:not([data-iu-click-bound])',
  );

  for (const span of spans) {
    span.setAttribute('data-iu-click-bound', 'true');
    span.style.cursor = 'pointer';
    span.title = 'Click to decrypt';
    span.addEventListener('click', () => showInlineDecryptPrompt(span));
  }
}

// ---------------------------------------------------------------------------
// Internal: show inline decrypt prompt
// ---------------------------------------------------------------------------

export function showInlineDecryptPrompt(anchorSpan: HTMLElement): void {
  // Close any existing prompt
  document
    .querySelectorAll('[data-iu-decrypt-prompt]')
    .forEach((el) => el.remove());

  // Create container
  const container = document.createElement('div');
  container.setAttribute('data-iu-decrypt-prompt', 'true');
  container.style.position = 'fixed';
  container.style.zIndex = '2147483647';

  // Position below anchor
  const anchorRect = anchorSpan.getBoundingClientRect();
  container.style.left = `${anchorRect.left}px`;
  container.style.top = `${anchorRect.bottom + 4}px`;

  // Attach closed Shadow DOM
  const shadow = container.attachShadow({ mode: 'closed' });

  // Style
  const style = document.createElement('style');
  style.textContent = PROMPT_STYLES;
  shadow.appendChild(style);

  // Prompt wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'prompt-container';
  shadow.appendChild(wrapper);

  // Saved passwords dropdown (hidden by default)
  const select = document.createElement('select');
  select.style.display = 'none';
  wrapper.appendChild(select);

  // Password input
  const input = document.createElement('input');
  input.type = 'password';
  input.placeholder = 'Enter password';
  wrapper.appendChild(input);

  // Decrypt button
  const button = document.createElement('button');
  button.textContent = 'Decrypt';
  wrapper.appendChild(button);

  // Error display
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error';
  wrapper.appendChild(errorDiv);

  // Load saved passwords and populate dropdown
  passwordsSetting.getValue().then((passwords) => {
    if (passwords.length > 0) {
      select.style.display = '';

      const defaultOpt = document.createElement('option');
      defaultOpt.textContent = '-- Saved passwords --';
      defaultOpt.disabled = true;
      defaultOpt.selected = true;
      select.appendChild(defaultOpt);

      for (const pw of passwords) {
        const opt = document.createElement('option');
        opt.value = pw.password;
        opt.textContent = pw.name;
        select.appendChild(opt);
      }

      select.addEventListener('change', () => {
        input.value = select.value;
      });
    }
  }).catch(() => {
    // Storage not available — ignore
  });

  // Decrypt handler
  async function doDecrypt(): Promise<void> {
    const password = input.value;
    if (!password) {
      errorDiv.textContent = 'Please enter a password';
      errorDiv.classList.add('visible');
      return;
    }

    button.disabled = true;
    button.textContent = 'Decrypting...';
    errorDiv.classList.remove('visible');

    try {
      const original = anchorSpan.getAttribute('data-iu-original') ?? '';
      const decoded = decodeTagsRun(original);
      const result = detectEncrypted(decoded);

      if (!result.encrypted) {
        errorDiv.textContent = 'Not encrypted content';
        errorDiv.classList.add('visible');
        button.disabled = false;
        button.textContent = 'Decrypt';
        return;
      }

      const plaintext = await decrypt(result.payload, password);

      // Success: replace highlight with decrypted text
      anchorSpan.textContent = plaintext;
      anchorSpan.setAttribute('data-iu-type', 'decrypted');
      anchorSpan.style.backgroundColor = '#A5D6A7';
      anchorSpan.style.cursor = '';
      anchorSpan.title = '';
      anchorSpan.setAttribute('data-iu-click-bound', 'decrypted');

      // Remove prompt
      container.remove();
      removeOutsideClickHandler();
    } catch (err) {
      if (err instanceof DecryptionError) {
        errorDiv.textContent = 'Wrong password or corrupted data';
      } else {
        errorDiv.textContent = 'Decryption failed';
      }
      errorDiv.classList.add('visible');
      button.disabled = false;
      button.textContent = 'Decrypt';
    }
  }

  button.addEventListener('click', doDecrypt);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doDecrypt();
  });

  // Append to body
  document.body.appendChild(container);

  // Viewport boundary checks
  const containerRect = container.getBoundingClientRect();

  // Bottom overflow: reposition above anchor
  if (containerRect.bottom > window.innerHeight) {
    const containerHeight = containerRect.height;
    container.style.top = `${anchorRect.top - containerHeight - 4}px`;
  }

  // Right overflow: shift left
  if (containerRect.right > window.innerWidth) {
    container.style.left = `${window.innerWidth - containerRect.width - 8}px`;
  }

  // Focus password input
  input.focus();

  // Dismiss on outside click
  let outsideClickHandler: ((e: MouseEvent) => void) | null = null;

  function removeOutsideClickHandler(): void {
    if (outsideClickHandler) {
      document.removeEventListener('click', outsideClickHandler, true);
      outsideClickHandler = null;
    }
  }

  setTimeout(() => {
    outsideClickHandler = (e: MouseEvent) => {
      const target = e.target as Node;
      // Check if click is inside the container (shadow DOM won't report inner targets)
      if (container.contains(target) || container === target) return;
      container.remove();
      removeOutsideClickHandler();
    };
    document.addEventListener('click', outsideClickHandler, true);
  }, 0);
}
