# Stegano

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Chrome extension for detecting, revealing, and encrypting hidden Unicode characters on any web page. Protect against prompt injection, ASCII smuggling, and invisible text attacks. Includes encoder/decoder, AES-256 encryption, and inline decryption for creating secure invisible messages using Unicode Tags block steganography.

## Features

### Detection & Scanning
- On-demand or automatic page scanning with inline highlighting
- Three detection sensitivity levels (Standard, Thorough, Paranoid)
- Tags block decoding -- reveals hidden ASCII encoded in Unicode Tags (U+E0000-E007F)
- Zero-width character labeling with Unicode code points
- AI watermark detection (narrow spaces used by LLM providers)
- Auto-detect encrypted hidden text with one-click inline decryption
- MutationObserver for dynamically loaded content
- Context menu scan toggle ("Scan Page" / "Clear Highlights")

### Encryption
- AES-256-GCM encryption with PBKDF2 key derivation (210,000 iterations)
- Optional compression before encryption for smaller payloads
- Encrypted text is encoded as invisible Unicode -- undetectable without the password
- Inline decryption: click any encrypted highlight to decrypt in-place
- Saved password manager (stored locally, never synced)
- Password-linked snippets for one-click encrypted paste

### Encoding & Snippets
- Encode/decode tool in popup for creating invisible messages
- Snippet library with context menu quick-paste
- Auto-copy encoded text to clipboard
- Per-class customizable highlight colors (tags=yellow, zero-width=orange, watermark=pink, encrypted=cyan)

### General
- Dark mode by default
- JSON export of scan findings
- Settings sync across devices
- All processing is local-only -- no data leaves the device
- No network calls, no analytics, no tracking (enforced by ESLint)

## Screenshots

Screenshots coming soon.

**Quick usage:** Install the extension, click the Stegano icon in the toolbar, then click "Scan Page for Hidden Characters". Hidden characters are highlighted inline with decoded text or Unicode code point labels. Use the encode/decode tool in the popup to create your own invisible messages.

## Installation

**Prerequisites:** Node.js 18+, pnpm

```bash
git clone https://github.com/dawid-ai/stegano.git
cd stegano
pnpm install
```

## Development

```bash
pnpm dev          # WXT dev server with hot reload
pnpm build        # Production build
pnpm test         # Run tests
pnpm compile      # TypeScript type-check
pnpm lint         # ESLint
```

## Loading in Chrome

1. Run `pnpm build`
2. Open `chrome://extensions`, enable Developer mode
3. Click "Load unpacked", select `.output/chrome-mv3`

## Architecture

Built with WXT, Preact, TypeScript, Tailwind CSS 4, and Vitest.

| Path | Purpose |
|------|---------|
| `utils/codec.ts` | Encode/decode between ASCII and Tags block Unicode |
| `utils/scanner.ts` | Pure scanner: findInvisibleChars, decodeTagsRun |
| `utils/charsets.ts` | Sensitivity presets and detection regex builder |
| `utils/crypto.ts` | AES-256-GCM encrypt/decrypt with PBKDF2 key derivation |
| `utils/markers.ts` | Encrypted content detection (ENC1: prefix) |
| `utils/compression.ts` | Optional deflate compression for encrypted payloads |
| `utils/storage.ts` | Typed storage items (sync + local storage) |
| `utils/messaging.ts` | Type-safe background/content script messaging |
| `utils/clipboard.ts` | Clipboard API with execCommand fallback |
| `utils/export.ts` | Scan report builder for JSON export |
| `utils/types.ts` | Shared TypeScript types |
| `entrypoints/background.ts` | Service worker: scan toggle, badge, context menus, shortcuts |
| `entrypoints/content.ts` | Content script: DOM scanning, highlighting |
| `entrypoints/content/decrypt-prompt.ts` | Inline decrypt prompt with Shadow DOM isolation |
| `entrypoints/popup/` | Popup UI: encode/decode/encrypt, scan trigger |
| `entrypoints/settings/` | Settings page: preferences, passwords, snippet manager |

## Privacy

All processing is local-only. The extension makes no network calls, collects no analytics, and sends no data off-device. This is enforced by an ESLint rule that bans all network APIs (fetch, XMLHttpRequest, WebSocket, EventSource, sendBeacon).

## Links

- Blog post: [dawid.ai/stegano](https://dawid.ai/stegano)
- Author: [Dawid Jozwiak](https://www.linkedin.com/in/jozwiakdawid/) on LinkedIn

## License

MIT -- see [LICENSE](LICENSE) file.
