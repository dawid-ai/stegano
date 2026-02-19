# Stack Research

**Domain:** Chrome Extension (Manifest V3) — Unicode security tool
**Researched:** 2026-02-19
**Confidence:** HIGH (core stack verified via official sources and multiple corroborating articles)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| WXT | 0.20.17 | Extension framework (build, dev mode, HMR, manifest generation) | Clear winner in 2026 — actively maintained (released Feb 12, 2026), Vite-based, framework-agnostic, auto-generates manifest.json from file structure, built-in HMR, vitest integration. Outcompetes Plasmo (maintenance mode) and bare CRXJS (too low-level) for new projects. |
| TypeScript | 5.x (via WXT) | Type safety across all extension contexts | Non-negotiable for a multi-context codebase (popup, content script, service worker). Chrome extension APIs have official `@types/chrome` declarations. WXT provides first-class TS support including typed auto-imports. |
| Preact | 10.x | Popup UI framework | This extension's popup has genuine UI complexity (converter fields, snippet list, settings) that warrants a component model. Preact at ~3KB gzip vs React's ~45KB gzip fits extension size constraints. WXT natively supports Preact via its Vite plugin. Vanilla TypeScript would become unmaintainable at this feature count; full React is oversized. |
| Tailwind CSS | 4.x | Popup and options page styling | Zero dead CSS in production via purging, consistent utility classes, works cleanly with WXT's Vite pipeline. Shadow DOM scoping note: use `px`-based config (not `rem`) to prevent host-page font-size inheritance in content script overlays. |
| Manifest V3 | 3 | Extension platform | Required for Chrome Web Store submission. All new extensions must use MV3. Service workers replace persistent background pages. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @webext-core/messaging | 2.3.0 | Type-safe message passing between popup, content scripts, and service worker | Use for all cross-context communication. The vanilla `chrome.runtime.sendMessage` API is error-prone and lacks type safety. This library wraps it with a typed `ProtocolMap` interface. WXT's own docs recommend it. |
| @webext-core/storage | latest | Type-safe wrappers around `chrome.storage.*` | Use instead of raw `chrome.storage.local` calls. Provides typed getters/setters with schema validation. Prevents typos in storage keys across contexts. |
| @webext-core/fake-browser | latest | In-memory browser API polyfill for tests | Required for vitest unit tests — provides real in-memory storage implementation so you never need to mock `browser.storage` manually. Used automatically by WXT's vitest plugin. |
| Vitest | 2.x (via WXT) | Unit testing | WXT's official testing recommendation. Has a dedicated `WxtVitest` plugin that wires up fake-browser, auto-imports, and path aliases automatically. No extra config needed for extension API mocking. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| WXT CLI (`npx wxt@latest init`) | Project scaffolding with template selection | Choose the Preact template during init. Generates manifest, entrypoints, and tsconfig correctly. |
| `pnpm` | Package manager | WXT officially supports pnpm, npm, and bun. Pnpm preferred for faster installs and strict dependency isolation — reduces "phantom dependency" issues common in extensions. |
| `wxt zip` | Production packaging | Builds and zips for Chrome Web Store submission. Handles MV3 manifest validation and asset bundling. |
| ESLint + `@typescript-eslint` | Linting | Catches type errors and bad patterns before runtime. Essential across three execution contexts that cannot easily share a debugger session. |

## Installation

```bash
# Scaffold project (choose "preact" template)
npx wxt@latest init invisible-unicode

# Core runtime dependencies
pnpm add preact
pnpm add @webext-core/messaging @webext-core/storage

# Dev dependencies
pnpm add -D vitest @webext-core/fake-browser
pnpm add -D tailwindcss @tailwindcss/vite
pnpm add -D typescript eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| WXT | Plasmo | Never for new projects in 2026. Plasmo is in maintenance mode, lags on dependency updates, and the community actively discourages new adoption. |
| WXT | CRXJS (bare Vite plugin) | Only if you need minimal abstraction and are an expert extension developer who wants full control over the Vite config. Not justified for this project. |
| WXT | Custom Vite + webpack setup | Only for teams already running a complex monorepo where WXT's opinionated structure conflicts with existing tooling. |
| Preact | React | Use React if bundle size is truly not a concern and the team has no Preact familiarity. React adds ~45KB gzip vs Preact's ~3KB — meaningful for an extension popup that loads on every click. |
| Preact | Svelte | Svelte produces smaller bundles but has less TypeScript tooling maturity and a smaller ecosystem of components to draw from. Reasonable alternative if the team prefers it. |
| Preact | Vanilla TypeScript | Only for trivial popups (2-3 DOM elements). This extension has a converter, snippet list, settings panel, and mode selector — vanilla DOM management will create maintenance debt. |
| Tailwind CSS | CSS Modules | CSS Modules work fine but require more configuration with WXT's multi-entrypoint structure. Tailwind's purging behavior is better for extension bundles. |
| @webext-core/messaging | webext-bridge | webext-bridge is a solid alternative (also recommended by WXT docs) but @webext-core/messaging is by the same author as WXT, ensuring better long-term compatibility. |
| chrome.storage.local | localStorage | localStorage is inaccessible in service workers (MV3 background context). Chrome.storage.local works across all extension contexts. Never use localStorage in a MV3 extension. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Plasmo | Maintenance mode since 2024, dependency lag, community discourages adoption | WXT |
| `localStorage` | Not available in MV3 service workers; cleared unexpectedly in content script context | `chrome.storage.local` via `@webext-core/storage` |
| Remote code execution | Forbidden by MV3 CSP — cannot load scripts from CDN, no `eval()`, no `new Function()` | Bundle all code; use `chrome.scripting.executeScript` with local files only |
| `chrome.webRequest` blocking | Deprecated in MV3 for extensions; removed from MV3 service worker context | `chrome.declarativeNetRequest` (not needed for this project) |
| Persistent background pages | MV3 replaces with service workers — no persistent background page available | Event-driven service worker with `chrome.storage.session` for ephemeral state |
| Inline scripts in HTML | Blocked by MV3 CSP | Reference external script files from popup.html; Vite handles this automatically |
| `chrome.tabs.executeScript` | Deprecated in MV3 | `chrome.scripting.executeScript` with `files` pointing to bundled content scripts |
| Jest | No native ESM support without complex config; WXT's ecosystem is Vitest-first | Vitest with WxtVitest plugin |

## Stack Patterns by Variant

**For popup UI (popup entrypoint):**
- Use Preact components + Tailwind CSS
- State: local Preact state + `@webext-core/storage` for persistence
- Communication: `@webext-core/messaging` to send commands to content script or service worker

**For content scripts (page DOM manipulation):**
- Use vanilla TypeScript — no Preact rendering here; DOM manipulation is direct
- Inject highlight overlays as `<span>` elements with inline styles or a Shadow DOM host
- Use Shadow DOM for the inline replacement UI to isolate Tailwind styles from host-page CSS
- Communication: `@webext-core/messaging` to receive scan commands from popup/service worker

**For service worker (background):**
- Vanilla TypeScript only — no DOM access, no Preact
- Keep logic minimal: badge updates, storage reads, message routing
- Use `chrome.storage.session` for scan results that should not persist across browser restarts
- Register all event listeners at top level (not inside async callbacks) — MV3 service workers reinitialize on each event

**For stats badge:**
- Update via `chrome.action.setBadgeText()` and `chrome.action.setBadgeBackgroundColor()` from the service worker
- Note: calling extension APIs extends service worker lifetime — badge updates keep the worker alive during active scanning

**For options/settings page:**
- Separate WXT entrypoint (`options/index.html`)
- Preact + Tailwind, same component patterns as popup
- Persist all settings to `chrome.storage.sync` (syncs across devices, 100KB limit — sufficient for this extension's config)
- Use `chrome.storage.local` for snippet storage (larger quota: 10MB)

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| WXT 0.20.17 | Vite 6.x, TypeScript 5.x | WXT manages Vite version internally — do not install Vite separately |
| Preact 10.x | WXT 0.20.x | Use `@preact/preset-vite` — WXT's Preact template configures this automatically |
| Tailwind CSS 4.x | Vite 6.x | Tailwind v4 uses `@tailwindcss/vite` plugin instead of PostCSS — simpler config |
| @webext-core/messaging 2.3.0 | Chrome MV3, Firefox | Works with WXT's fake-browser polyfill for testing |
| Vitest 2.x | WXT 0.20.x | Use `wxt/testing/vitest-plugin` — do not configure vitest independently |

## Chrome Storage Strategy for This Project

| Data Type | Storage Area | Quota | Rationale |
|-----------|-------------|-------|-----------|
| User settings (detection mode, highlight color, shortcuts) | `chrome.storage.sync` | 100KB total, 8KB/item | Syncs across devices; settings are small |
| Named snippets | `chrome.storage.local` | 10MB | Snippets can accumulate; local quota is generous |
| Current page scan results | `chrome.storage.session` | 10MB, cleared on browser restart | Ephemeral — no need to persist across sessions |
| Badge count | In-memory service worker state + session storage | — | Re-computed on page load; session fallback for service worker restarts |

## Sources

- WXT official site and GitHub (wxt.dev, github.com/wxt-dev/wxt) — version 0.20.17 confirmed February 12, 2026 — HIGH confidence
- "The 2025 State of Browser Extension Frameworks" (redreamality.com) — Plasmo vs WXT vs CRXJS comparison — MEDIUM confidence (single analysis article, consistent with other sources)
- Chrome for Developers — chrome.storage API documentation (developer.chrome.com/docs/extensions/reference/api/storage) — storage quotas verified — HIGH confidence
- Chrome for Developers — Manifest V3 migration guide (developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3) — MV3 constraints verified — HIGH confidence
- WXT messaging guide (wxt.dev/guide/essentials/messaging) — recommends @webext-core/messaging — HIGH confidence
- WXT unit testing guide (wxt.dev/guide/essentials/unit-testing) — vitest + WxtVitest plugin — HIGH confidence
- @webext-core/messaging npm (npmjs.com/package/@webext-core/messaging) — version 2.3.0 confirmed — MEDIUM confidence (npm page returned 403 during direct fetch; version confirmed via search result)
- "Build Chrome Extensions with React and Vite in 2025" (artmann.co) — Tailwind CSS with Vite for extensions — MEDIUM confidence
- GitHub: wxt-dev/examples vitest-unit-testing example — corroborates testing setup — MEDIUM confidence

---
*Stack research for: Chrome Manifest V3 extension — InvisibleUnicode*
*Researched: 2026-02-19*
