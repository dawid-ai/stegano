# Stegano

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Chrome extension for detecting and revealing hidden Unicode characters on any web page. Protect against prompt injection, ASCII smuggling, and invisible text attacks. Also includes an encoder/decoder for creating your own invisible messages using Unicode Tags block steganography.

## Features

- On-demand page scanning with inline highlighting
- Three detection sensitivity levels (Standard, Thorough, Paranoid)
- Tags block decoding -- reveals hidden ASCII encoded in Unicode Tags (U+E0000-E007F)
- Zero-width character labeling with Unicode code points
- AI watermark detection (narrow spaces used by LLM providers)
- Encode/decode tool in popup for creating invisible messages
- Snippet library with keyboard shortcuts for quick-paste
- Per-class customizable highlight colors (tags=yellow, zero-width=orange, watermark=pink)
- Dark mode support
- JSON export of scan findings
- MutationObserver for dynamically loaded content
- All processing is local-only -- no data leaves the device

## Screenshots

Screenshots coming soon.

**Quick usage:** Install the extension, click the Stegano icon in the toolbar, then click "Scan Page for Hidden Characters". Hidden characters are highlighted inline with decoded text or Unicode code point labels. Use the encode/decode tool in the popup to create your own invisible messages.

## Installation

**Prerequisites:** Node.js 18+, pnpm

```bash
git clone <repo-url>
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
| `utils/storage.ts` | Typed storage items (sync storage) |
| `utils/messaging.ts` | Type-safe background/content script messaging |
| `utils/clipboard.ts` | Clipboard API with execCommand fallback |
| `utils/export.ts` | Scan report builder for JSON export |
| `utils/types.ts` | Shared TypeScript types |
| `entrypoints/background.ts` | Service worker: scan toggle, badge, shortcuts |
| `entrypoints/content.ts` | Content script: DOM scanning, highlighting |
| `entrypoints/popup/` | Popup UI: encode/decode, scan trigger |
| `entrypoints/settings/` | Settings page: preferences, snippet manager |

## Privacy

All processing is local-only. The extension makes no network calls, collects no analytics, and sends no data off-device. This is enforced by an ESLint rule that bans all network APIs (fetch, XMLHttpRequest, WebSocket, EventSource, sendBeacon).

## Links

- Blog post: [dawid.ai/stegano](https://dawid.ai/stegano)
- Author: [Dawid Jozwiak](https://www.linkedin.com/in/jozwiakdawid/) on LinkedIn

## License

MIT -- see [LICENSE](LICENSE) file.
