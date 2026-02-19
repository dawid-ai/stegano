# Project Research Summary

**Project:** InvisibleUnicode
**Domain:** Chrome Manifest V3 Browser Extension — Unicode invisible character converter and page scanner
**Researched:** 2026-02-19
**Confidence:** HIGH (stack and architecture verified against official docs; features MEDIUM — thin competitive landscape)

## Executive Summary

InvisibleUnicode is a Chrome extension that encodes and decodes invisible Unicode characters (zero-width chars and the Tags block U+E0000–U+E007F) and scans pages for hidden Unicode used in fingerprinting, AI watermarking, and prompt injection attacks. The correct way to build this in 2026 is with WXT (the clear winner over Plasmo and bare CRXJS), Preact for popup UI, and TypeScript throughout all three extension contexts (popup, content script, service worker). The extension has a clear competitive gap: no existing Chrome extension covers the Tags block for both encoding/decoding AND in-page detection, and no competitor addresses AI watermark detection. This is the primary differentiator to build toward.

The fundamental architectural challenge is that a Chrome MV3 extension is not a single application — it is three isolated execution contexts (popup, service worker, content script) that can only communicate via async message passing and shared chrome.storage. The service worker terminates after 30 seconds of inactivity and loses all in-memory state. Every piece of shared state must live in chrome.storage, not in variables. The content script accesses the page DOM but runs in a JavaScript-isolated world. Getting this architecture right in Phase 1 prevents near-complete rewrites later.

The critical risks are: (1) Service worker state loss that causes silent feature failures after browser idle — must be addressed architecturally before any feature is built. (2) DOM manipulation in content scripts breaking React/Vue SPAs like Gmail and Google Docs — requires careful Text node surgery, never element wrapping. (3) Broad host permissions triggering Chrome Web Store rejection — the permission model (activeTab for MVP, optional all_urls for auto-scan) must be decided in Phase 1 and cannot be retrofitted. (4) XSS vulnerability via innerHTML in content scripts — must be blocked by lint rule from day one. All four risks are preventable if addressed in the correct phase.

## Key Findings

### Recommended Stack

WXT 0.20.17 is the unambiguous choice for project scaffolding. It is Vite-based, actively maintained (released Feb 12, 2026), framework-agnostic, and auto-generates the MV3 manifest from file structure. Plasmo — the main alternative — is in maintenance mode as of 2024 and the community actively discourages new adoption. Preact (3KB gzip) is the right UI framework for the popup: the feature count (encoder, decoder, snippets, settings) warrants a component model, but React's 45KB gzip is unnecessarily large for an extension popup. Tailwind CSS 4.x with the `@tailwindcss/vite` plugin handles styling with zero dead CSS in production. All cross-context communication must use `@webext-core/messaging` instead of raw `chrome.runtime.sendMessage` for type safety across the three isolated contexts.

**Core technologies:**
- WXT 0.20.17: Extension framework (scaffolding, HMR, MV3 manifest generation) — only actively maintained option in 2026
- TypeScript 5.x: Type safety across all three execution contexts — non-negotiable at this feature count
- Preact 10.x: Popup/options UI — 3KB gzip fits extension constraints; UI complexity warrants a component model
- Tailwind CSS 4.x: Styling — zero dead CSS, works with WXT's Vite pipeline; use `px` units in Shadow DOM contexts
- @webext-core/messaging 2.3.0: Type-safe message passing — prevents a class of runtime errors common with raw chrome.runtime API
- @webext-core/storage: Typed chrome.storage wrappers — prevents key typos across contexts
- Vitest 2.x + @webext-core/fake-browser: Testing — WXT's official stack; fake-browser provides in-memory chrome.storage for unit tests

### Expected Features

The extension's MVP must deliver encode/decode for both character classes (zero-width AND Tags block — competitors cover only zero-width), a page scanner with on-demand trigger, in-page highlighting, and a badge count. These are all table stakes for the security tool niche. The Tags block support is both table stakes AND a differentiator: users seeking it will find no alternative, making it a retention mechanism from first install.

**Must have (table stakes — v1):**
- Popup encoder: text → invisible Unicode output (both ZW chars and Tags block U+E0000–U+E007F)
- Popup decoder: invisible text → plaintext (both character classes)
- Copy-to-clipboard with confirmation — absence causes immediate negative reviews
- Page scanner with on-demand trigger (button click)
- In-page highlight of detected characters at character level (not element level)
- Extension icon badge count — explicitly requested in user research and HN discussions
- Fully local processing with zero network calls — trust foundation, must be architecturally enforced

**Should have (competitive differentiators — v1.x):**
- Configurable scan modes (always-on / on-demand / badge-only) — no competitor offers this
- AI watermark detection mode with named labels (e.g., "AI watermark candidate") — no competitor covers this gap
- Saved snippets library — unique in the niche, high value for power users
- Character-level breakdown in scan results (U+XXXX codepoint, Unicode name, count) — developers need details
- Keyboard shortcuts for encode/decode/scan via chrome.commands API

**Defer (v2+):**
- Export scan report (JSON/clipboard) — useful for security researchers; validate demand first
- Non-destructive highlight toggle (on/off without page reload) — polish, not launch blocker
- Configurable highlight color — cosmetic preference
- Firefox port — valid long-term goal; splits focus at launch

**Anti-features to explicitly avoid:**
- Auto-strip all invisible chars from pages — breaks emoji ZWJ sequences, causes rendering corruption
- LLM/external API integration — violates the privacy-first trust proposition
- Cloud snippet sync to a proprietary server — use chrome.storage.sync (no third-party server) instead
- Real-time character-by-character scanning on input events — CPU cost is prohibitive

### Architecture Approach

The extension has four components connected purely by message passing and chrome.storage. The popup is a Preact mini-app that handles UI and sends commands. The service worker handles badge updates, keyboard shortcuts, and command routing — it runs event-driven and has no persistent in-memory state. The content script runs in each tab's DOM context, performs the TreeWalker scan, and mutates the DOM for highlighting. All shared state goes through chrome.storage (sync for settings, local for snippets, session for ephemeral scan results). The encode/decode logic lives in pure TypeScript functions in `src/core/unicode.js` — shared between popup and content script with no extension API dependencies, making them independently testable.

**Major components:**
1. Popup (Preact + Tailwind) — encode/decode UI, snippet management, scan trigger; communicates via chrome.tabs.sendMessage and chrome.storage directly
2. Service Worker (TypeScript, event-driven) — badge text/color, keyboard shortcut handling, on-demand script injection; all state persisted to chrome.storage on every event
3. Content Script (vanilla TypeScript) — TreeWalker DOM scanner, Text node highlighter using DOM APIs only; Shadow DOM host for injected UI to isolate extension CSS
4. src/core/ (pure TypeScript) — unicode.js encode/decode functions, scanner.js TreeWalker logic; zero extension API dependencies; imported by both popup and content script bundles
5. src/shared/ — messaging.js type constants, storage.js typed wrappers; single source of truth for cross-context contracts
6. chrome.storage (three areas) — sync for user settings (100KB limit), local for snippets (10MB limit), session for scan result cache (cleared on browser restart)

The build order follows the dependency graph: core functions first, then shared layer, then content script and service worker, then popup. Starting with pure core functions means the most critical logic (Unicode encoding, character detection) is verified before any extension plumbing is touched.

### Critical Pitfalls

1. **Service worker state loss on termination** — Never store authoritative state in global variables in background.js. Every handler must read from chrome.storage on wake. Register all event listeners synchronously at top-level scope. Verify by stopping the service worker via DevTools and confirming all features still work. Address in Phase 1 — retrofitting this later requires near-complete rewrite.

2. **DOM manipulation breaking host pages (React/Vue SPAs)** — Use `Text.splitText()` to split text nodes; wrap only the invisible character position in a `<span>`; never wrap element nodes. Disconnect MutationObserver before making mutations to prevent observer loops. Test against Gmail, Google Docs, Twitter/X, and Reddit before considering the scanner feature done. Address in Phase 2.

3. **Broad host permissions triggering CWS rejection** — Start with `activeTab` permission for on-demand scanning. Implement `<all_urls>` as an optional permission requested via `chrome.permissions.request()` at runtime, not declared statically. Write the privacy policy before submission — it must explicitly state no browsing data leaves the device. This is a Phase 1 architectural decision.

4. **innerHTML XSS vulnerability in content scripts** — Never use `innerHTML`, `outerHTML`, or `insertAdjacentHTML` on any content derived from page text. Use only `document.createElement()`, `element.textContent`, and `Text.splitText()`. Add a pre-commit ESLint rule that flags `innerHTML` assignments in content script files. Address in Phase 2, enforced as a code review gate.

5. **Performance degradation on text-heavy and infinite-scroll pages** — Use `requestIdleCallback()` for initial page scans (batch ~500–1000 nodes per idle frame). Debounce MutationObserver callbacks with 250–500ms delay. Limit scan scope to `document.body` only. Benchmark against Wikipedia articles as a Phase 2 completion criterion — must not add more than 200ms to Time-to-Interactive.

6. **Unicode regex without `/u` flag** — The Tags block (U+E0000–U+E007F) requires surrogate pairs in non-Unicode-mode regex. Always use `/[\u{E0000}-\u{E007F}]/gu` syntax with the `/u` flag. Write explicit unit tests for Tags block characters (e.g., U+E0041) before Phase 2 is complete.

## Implications for Roadmap

Based on combined research, the dependency graph and pitfall phase-mapping produce a clear 6-phase structure. The architecture research explicitly recommended this ordering; the pitfalls research confirms why deviations are costly.

### Phase 1: Foundation — Core Logic, Build Setup, and Architecture
**Rationale:** Pure unicode.js and scanner.js functions have no extension API dependencies and can be built and tested in complete isolation. The storage strategy, permission model, and build configuration must be locked before any cross-context feature is built — these decisions cannot be retrofitted cheaply. The service worker state loss pitfall and the remotely-hosted code pitfall both require Phase 1 prevention.
**Delivers:** Working encode/decode functions with full unit test coverage; WXT project scaffolded with Preact template; bundler verified to produce a self-contained package; manifest.json with permission model decided (activeTab + optional all_urls); storage strategy documented and implemented (sync/local/session allocation); shared messaging constants and typed storage wrappers.
**Addresses:** Core encode/decode table stakes (foundation layer); Tags block + ZW discrimination (built into core from day one)
**Avoids:** Service worker state loss (storage-first pattern established before any stateful feature); remotely-hosted code rejection (bundler config verified before first CWS submission); storage quota misallocation (sync vs. local vs. session decided here)
**Research flag:** Skip deeper research — WXT and MV3 patterns are extremely well-documented via official sources. Standard patterns apply.

### Phase 2: Core Extension — Content Script Scanner and Highlight
**Rationale:** The content script is the most complex and risk-laden component. It needs its own phase because: DOM manipulation pitfalls require integration testing against fragile sites; the XSS lint rule must be established before any innerHTML could creep in; and performance benchmarks must be completion criteria, not afterthoughts. The badge count depends on scanner output, so it ships here too.
**Delivers:** Content script with TreeWalker scanner covering both ZW chars and Tags block; in-page character-level highlighting using DOM API only (no innerHTML); badge count updated via service worker after each scan; on-demand scan trigger from popup; integration tests passing against Gmail, Google Docs, Twitter/X, Reddit; Lighthouse benchmark on Wikipedia showing less than 200ms TTI impact.
**Uses:** content.js (vanilla TypeScript), src/core/scanner.js, @webext-core/messaging, chrome.action badge API
**Implements:** Content Script component, Page Scan flow, Inline Replacement flow
**Avoids:** DOM manipulation breaking host pages (Text.splitText pattern, integration test gate); innerHTML XSS (ESLint rule in place); Tags block regex without /u flag (unit tests enforcing /u flag); performance on large DOMs (requestIdleCallback chunking as completion criterion)
**Research flag:** Needs care during implementation — DOM manipulation against live SPAs requires manual testing that no automated research can replace. The pitfall patterns are well-documented, but per-site breakage is discovered empirically.

### Phase 3: Service Worker and Settings
**Rationale:** Service worker event handling and settings persistence are needed before the popup can display correct state. Keyboard shortcuts and badge logic complete the non-popup UX. Settings storage (chrome.storage.sync) must be validated separately from snippet storage (chrome.storage.local) because the quota constraints differ and misallocation causes user-facing bugs.
**Delivers:** Service worker with badge update logic; keyboard shortcut handling via chrome.commands; on-demand content script injection with URL validation (no chrome:// pages); settings persistence in chrome.storage.sync; per-domain disable toggle; storage.onChanged listener for cross-context settings sync; service worker cold-start verification (all features work after DevTools stop/restart).
**Uses:** background.js (TypeScript), chrome.commands API, chrome.scripting.executeScript, chrome.storage.session + sync
**Implements:** Service Worker component, Keyboard Shortcut flow, Settings Persistence flow
**Avoids:** Service worker cold-start failures (explicit cold-start test as completion criterion); message passing errors (all sendMessage wrapped with lastError handling); incognito mode surprises (graceful failure path documented)
**Research flag:** Skip deeper research — service worker patterns are well-documented in official Chrome docs.

### Phase 4: Popup UI
**Rationale:** The popup depends on messaging contracts from Phase 2 (content script) and Phase 3 (service worker) being stable. Building UI against unstable contracts wastes effort on rewrites. Popup is the most visible surface but not the most architecturally risky — it benefits from being built last against confirmed APIs.
**Delivers:** Full popup UI with Encode tab, Decode tab, Snippets tab; copy-to-clipboard with "Copied!" confirmation; clear/reset buttons; scan trigger button that shows findings list; character-level breakdown display (U+XXXX, Unicode name, count, location); scan results read from chrome.storage.session; page-sourced text always rendered via textContent (never innerHTML in popup).
**Uses:** Preact 10.x, Tailwind CSS 4.x, @webext-core/storage, @webext-core/messaging
**Implements:** Popup component, Encode/Decode flow, basic Snippet UI
**Avoids:** XSS via popup innerHTML (textContent enforced, lint rule extended to popup); raw codepoints shown to non-technical users (human-readable labels alongside U+XXXX notation)
**Research flag:** Skip deeper research — Preact + Tailwind patterns are standard. The popup is a mini-app with no unusual integration requirements.

### Phase 5: Differentiating Features — Snippets, AI Watermark Detection, Scan Modes
**Rationale:** These features depend on the full popup-content script-service worker stack being stable. They are the v1.x features from the MVP definition — add after core is working and first user feedback can inform priorities. Implementing these before the core is proven risks building features no one uses.
**Delivers:** Saved snippets library with chrome.storage.local persistence; AI watermark detection mode with named character labels ("AI watermark candidate", "Unicode fingerprint"); configurable scan modes (always-on / on-demand / badge-only) with chrome.storage.sync persistence; optional host permission request flow (chrome.permissions.request for all_urls in auto-scan mode).
**Uses:** chrome.storage.local (snippets, 10MB), chrome.storage.sync (mode preference), chrome.permissions API
**Implements:** Saved Snippets feature, AI Watermark Detection mode, Configurable Scan Mode feature
**Avoids:** Snippets in chrome.storage.sync (wrong quota — 100KB limit vs. 10MB for local); auto-scan enabled without user opt-in (default is on-demand; auto-scan requires explicit user activation); broad host permission declared statically in manifest (request at runtime via optional permission flow)
**Research flag:** AI watermark detection character patterns need validation. The RumiDocs source on ChatGPT watermark characters is LOW confidence (single unverified source). Before building the named-label lookup table, verify the specific character sequences (U+202F narrow no-break space, U+200B zero-width space) against current GPT model output empirically.

### Phase 6: Polish and Chrome Web Store Submission
**Rationale:** CWS submission is not just "upload the zip." The permission justification, privacy policy, and store description are reviewed as part of the extension. Missing or vague policy copy causes rejection. Incognito behavior, extension-update-mid-session edge cases, and storage quota error handling must be verified before exposure to real users.
**Delivers:** Privacy policy live and linked (explicitly covers no data exfiltration); store listing with permission justification; storage quota exceeded error surfaced gracefully to user; highlight cleanup on SPA navigation (window.pagehide and history API); incognito mode documented (graceful degradation or opt-in); extension-update-mid-session message passing compatibility tested; `wxt zip` verified to produce a self-contained package with no external URL references.
**Addresses:** CWS rejection for permissions (justification copy in listing); privacy policy requirement; "looks done but isn't" checklist items from PITFALLS.md
**Research flag:** No deeper research needed — CWS submission requirements are fully documented in official Chrome Web Store policies. This is an execution phase, not a research phase.

### Phase Ordering Rationale

- **Core before extension plumbing:** Phases 1-2 establish the unicode.js and scanner.js pure functions with unit tests before any chrome.* API is used. This means the most critical domain logic is verified in isolation.
- **Content script before popup:** Phase 2 (content script) before Phase 4 (popup) because the popup's scan trigger and results display depend on the content script messaging contract being stable. Building the popup against an unstable content script API means rewriting UI when the API changes.
- **Architecture constraints in Phase 1:** The three Phase 1 pitfalls (state loss, remote code, permissions) all require architectural decisions that cannot be retrofitted. Delaying them to accommodate features is the most common extension development mistake.
- **Differentiators after core:** Phase 5 features (snippets, AI watermark, scan modes) are intentionally post-core. They depend on the full stack being working and on real user feedback to confirm which differentiators actually matter. Building them before launch risks feature creep that delays the core.

### Research Flags

Phases needing deeper research or manual validation during planning/implementation:
- **Phase 2 (Content Script):** DOM manipulation compatibility against live SPAs cannot be researched in advance — it requires manual testing against target sites (Gmail, Google Docs, Twitter/X, Reddit) as an explicit completion gate. No additional structured research needed, but manual verification is required.
- **Phase 5 (AI Watermark Detection):** The specific character sequences used by current LLM models for watermarking are LOW confidence from available sources. Before building the named-label lookup table, empirically test current GPT/Claude outputs to identify actual characters used. This is a 2-hour validation task, not a research sprint.

Phases with standard patterns — skip research-phase:
- **Phase 1 (Foundation):** WXT and MV3 are extremely well-documented. Official docs are authoritative and complete.
- **Phase 3 (Service Worker):** Service worker lifecycle and chrome.commands patterns are standard MV3 content, all documented in official Chrome developer docs.
- **Phase 4 (Popup UI):** Preact + Tailwind is a standard web UI stack with no extension-specific complexity.
- **Phase 6 (CWS Submission):** Process is documented in official CWS policies. No research needed — execution only.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | WXT 0.20.17 verified Feb 12, 2026 from official GitHub. All supporting library choices verified from official WXT docs and npm. Plasmo maintenance-mode status corroborated across multiple community sources. |
| Features | MEDIUM | Competitive landscape is thin. Chrome Web Store competitor listings are the primary source. Feature gaps (Tags block, AI watermark) are real but demand validation from actual users, not just research. |
| Architecture | HIGH | All claims verified against official Chrome developer documentation. Component boundaries, storage areas, and message passing patterns are directly from official guides with no ambiguity. |
| Pitfalls | HIGH | MV3 lifecycle, CWS policies, and content script isolation verified against official docs and OWASP browser extension security references. Unicode-specific pitfalls corroborated across security research sources. |

**Overall confidence:** HIGH

### Gaps to Address

- **AI watermark character patterns:** The specific Unicode characters inserted by current LLM models (GPT-o3/o4-mini, Claude) as watermarks are not verified by high-confidence sources. The character list for the AI watermark detection mode must be validated empirically before Phase 5 implementation. Treat this as a 1-2 hour research spike at Phase 5 start, not a blocker for earlier phases.

- **Extension popup size constraints:** No specific byte size limit was confirmed for extension popups beyond the general "bundle size matters for UX." The Preact + Tailwind choice is well-justified by the 3KB vs 45KB comparison, but actual popup load time under the Preact stack was not benchmarked. Measure empirically in Phase 4.

- **CWS review timeline for security tools:** Research indicates security tools face heightened scrutiny and extended review (weeks not days). No specific data on current average review time for MV3 security extensions was found. Plan for 2-4 week review window when scheduling Phase 6.

- **Clipboard API compatibility for Tags block characters:** One source mentioned potential clipboard round-trip failures for encoded text in some applications. Test clipboard compatibility (plain text editor, Gmail, Slack, VS Code, Word) as a Phase 2 completion criterion rather than an afterthought.

## Sources

### Primary (HIGH confidence)
- WXT official site and GitHub (wxt.dev, github.com/wxt-dev/wxt) — version 0.20.17, framework choice, testing setup, messaging recommendations
- Chrome Developers — chrome.storage API (developer.chrome.com/docs/extensions/reference/api/storage) — storage quotas and areas
- Chrome Developers — Manifest V3 migration guide — MV3 constraints and service worker lifecycle
- Chrome Developers — Content scripts, Message passing, chrome.action, chrome.commands, chrome.scripting APIs — all component patterns
- Chrome Developers — CWS Program Policies and CWS Policy Updates 2025 — submission requirements and permission scrutiny
- Chrome Developers — Extension service worker lifecycle — termination behavior, cold start patterns
- MDN — TreeWalker — DOM scanning approach
- OWASP Browser Extension Vulnerabilities Cheat Sheet — innerHTML XSS patterns, content script security

### Secondary (MEDIUM confidence)
- GitHub: roymckenzie/detect-zero-width-characters-chrome-extension — open-source competitor architecture
- StegZero (stegzero.com) — encoder/decoder feature baseline
- ASCII Smuggler Tool (embracethered.com) — Tags block U+E0000 use cases and security context
- Show HN: zero-width character extension (Hacker News, 2018) — user feature requests and badge count demand
- BleepingComputer — Zero-width character fingerprinting article — security use case validation
- "The 2025 State of Browser Extension Frameworks" (redreamality.com) — Plasmo vs WXT comparison
- DebugBear — Chrome Extensions Website Performance — performance measurement methodology
- Extension Radar — CWS rejection patterns — permission scrutiny details
- Originality.AI — AI watermarking context and user demand
- Detect Zero-Width Characters and Invisible Characters Tool (Chrome Web Store listings) — competitor feature sets

### Tertiary (LOW confidence)
- RumiDocs — "New ChatGPT Models Leave Watermarks" — specific AI watermark characters; single unverified source, requires empirical validation before Phase 5

---
*Research completed: 2026-02-19*
*Ready for roadmap: yes*
