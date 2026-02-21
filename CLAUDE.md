# Stegano — Project Context

## Project
Chrome extension to detect and reveal hidden Unicode characters on any web page. Protects against prompt injection, ASCII smuggling, and invisible text attacks. Also includes encode/decode tools.

## Links
- **Blog post:** https://dawid.ai/stegano
- **Author LinkedIn:** https://www.linkedin.com/in/jozwiakdawid/
- **GitHub repo:** https://github.com/dawid-ai/stegano
- **Privacy policy:** https://dawid-ai.github.io/stegano/privacy-policy.html
- **Demo page:** https://dawid-ai.github.io/stegano/demo.html

## Tech Stack
- WXT 0.20.17 (browser extension framework)
- Preact (UI)
- TypeScript
- Tailwind CSS 4.x with `@custom-variant dark (&:where(.dark, .dark *))` for dark mode
- Vitest for testing
- pnpm with hoisted node-linker (.npmrc)

## Key Architecture
| Path | Purpose |
|------|---------|
| `utils/codec.ts` | Encode/decode ASCII <-> Tags block Unicode |
| `utils/scanner.ts` | Pure scanner: findInvisibleChars, decodeTagsRun |
| `utils/charsets.ts` | Sensitivity presets and regex builder |
| `utils/storage.ts` | Typed sync storage items |
| `utils/messaging.ts` | Type-safe extension messaging |
| `entrypoints/background.ts` | Service worker: scan toggle, badge, shortcuts |
| `entrypoints/content.ts` | Content script: DOM scanning, highlighting, snippet shortcuts |
| `entrypoints/popup/` | Popup UI: encode/decode, scan trigger |
| `entrypoints/settings/` | Settings: theme, colors, sensitivity, snippets |
| `docs/` | Privacy policy and demo page (GitHub Pages) |

## Build Commands
```bash
pnpm dev          # WXT dev server with hot reload
pnpm build        # Production build -> .output/chrome-mv3/
pnpm test         # Run Vitest tests
pnpm compile      # TypeScript type-check
pnpm lint         # ESLint
```

## Important Conventions
- All storage uses Chrome sync storage (cross-device sync)
- Snippets store **encoded** invisible content; users type visible text that gets encoded on save
- Alt+Shift prefix for all keyboard shortcuts
- Three character classes with distinct colors: tags (yellow), zerowidth (orange), watermark (pink)
- No network calls ever — enforced by ESLint rule banning fetch/XHR/WebSocket
- Dark mode is default, uses class-based variant on `<html>` element
- `activeTab` permission for on-demand; `all_urls` as optional for auto-scan
