# Pitfalls Research

**Domain:** Chrome Extension — Security/Text-Processing (Unicode detection and encoding tool)
**Researched:** 2026-02-19
**Confidence:** HIGH (MV3 lifecycle, CWS policy, content script isolation verified against official docs; Unicode-specific pitfalls verified against multiple sources)

---

## Critical Pitfalls

### Pitfall 1: Service Worker State Loss on Termination

**What goes wrong:**
MV3 service workers terminate after 30 seconds of inactivity. Any in-memory global variables — lookup tables, cached settings, conversion state — are destroyed. Code that works in dev (service worker stays active during testing) fails silently in production when the worker wakes from a cold start with no state.

**Why it happens:**
MV3 replaced persistent background pages with service workers. Developers familiar with MV2's persistent background pages assume in-memory state survives across events. It does not. A service worker can be killed between the user clicking the popup and the content script responding.

**How to avoid:**
Never store authoritative state in global variables in the service worker. Use `chrome.storage.session` for ephemeral state that must survive within a browser session (1 MB limit) and `chrome.storage.local` for persistent settings. Treat every service worker activation as a cold start. Register all event listeners synchronously at top-level scope — listeners registered inside async callbacks will not fire for events that woke the worker.

**Warning signs:**
- Settings appear to "reset" randomly for some users
- Features work during active use but break after the browser has been idle
- Console errors only appear in fresh sessions, not during active development
- `runtime.lastError` messages about disconnected ports appearing intermittently

**Phase to address:**
Architecture phase (Phase 1). The storage strategy must be decided before any feature is built. Retrofitting async-safe storage into a state-heavy service worker causes a near-complete rewrite.

---

### Pitfall 2: Content Script DOM Manipulation Breaking Host Pages

**What goes wrong:**
The extension modifies the DOM of every page it runs on to highlight or replace hidden Unicode characters. This can corrupt React, Angular, and Vue virtual DOM trees (which expect to own their DOM nodes), break page JavaScript that reads `textContent` from elements the extension has wrapped, and trigger visual layout breaks on pages that use fragile CSS selectors like `:first-child` and `nth-child`.

**Why it happens:**
Content scripts share DOM access with the host page despite running in an isolated JavaScript world. Wrapping text nodes in `<span>` highlight elements changes the structure that the page's own JS and CSS targets. Sites like Gmail, Google Docs, and any SPA with a virtual DOM are especially fragile.

**How to avoid:**
Use `Text` node replacement only — wrap individual `Text` nodes rather than `Element` nodes. Avoid inserting elements as siblings of existing elements; always use `Text.splitText()` and wrap only the invisible character positions. Use `MutationObserver.disconnect()` before making mutations (prevents observer loops). Test against Google Docs, Gmail, Twitter/X, and Reddit as representative fragile-site targets. Provide an `exclude_matches` list in `manifest.json` for known-fragile sites. Consider Shadow DOM for any injected UI so extension CSS cannot leak into the page.

**Warning signs:**
- Pages lose functionality after the extension highlights content (links stop working, forms break)
- JS errors in the page's own scripts after extension runs
- React/Vue hydration errors in the console
- Extension highlights disappear when the page re-renders

**Phase to address:**
Core feature phase (Phase 2, DOM scanning and highlighting). Include integration tests against a fixed set of known-fragile pages before considering this feature done.

---

### Pitfall 3: Broad Host Permissions Triggering CWS Review Rejection

**What goes wrong:**
The extension needs `<all_urls>` or `*://*/*` host permissions to scan every page. This is the single highest-scrutiny permission in Chrome Web Store reviews. Extensions with broad host permissions face extended review times (weeks not days) and a high likelihood of rejection if the justification is not crystal-clear in the extension description, privacy policy, and manifest.

**Why it happens:**
Google's automated and manual review classifies `<all_urls>` as a "sensitive execution permission" that enables browsing history collection, credential harvesting, and traffic interception. Security tools are a known attack vector — malicious extensions routinely disguise themselves as security tools. Reviewers apply extra skepticism to this category.

**How to avoid:**
Use `activeTab` permission for on-demand scanning triggered by user action (popup button click) instead of automatic scanning. Reserve `<all_urls>` only for passive automatic scanning, and if used, prominently justify it in the store listing ("This extension scans all pages to detect invisible Unicode characters that could be used to hide malicious content"). Write the privacy policy before submitting — it must specifically address that no browsing data is transmitted. Request optional permissions via `chrome.permissions.request()` at runtime rather than declaring all permissions statically in the manifest.

**Warning signs:**
- First submission rejected citing "Use of Permissions" policy
- Review taking more than 2 weeks
- Rejection email cites "Purple Potassium" code (permissions violation)

**Phase to address:**
Architecture and pre-submission phase. Permission model must be finalized in Phase 1. Automatic scanning vs. on-demand scanning is a fundamental design decision, not a UX detail.

---

### Pitfall 4: innerHTML Usage Creating XSS Vulnerabilities in Content Scripts

**What goes wrong:**
Content scripts that use `innerHTML`, `outerHTML`, or `insertAdjacentHTML` to inject highlight markup can introduce cross-site scripting vulnerabilities. A page with attacker-controlled text (e.g., a forum post containing `<img src=x onerror=...>`) could escape the text rendering and execute in the extension's context, which has elevated privileges (access to `chrome.storage`, `chrome.tabs`, etc.).

**Why it happens:**
The most natural way to highlight text is to replace `element.innerHTML` with a string containing `<mark>` or `<span>` tags. This is exactly what the OWASP browser extension security guide explicitly calls out as the primary content script vulnerability. The Reddit Enhancement Suite XSS bug worked this way.

**How to avoid:**
Never use `innerHTML` to inject content derived from page text. Use DOM APIs exclusively: `document.createElement()`, `element.appendChild()`, `Text.splitText()`, `node.textContent`. If you need to inject HTML for the highlight wrapper, create elements programmatically and set `textContent` on them, never `innerHTML`. Use `DOMPurify` as a defensive belt-and-suspenders measure if any HTML string construction is unavoidable. Add CSP headers to the extension's own pages (`popup.html`, `options.html`).

**Warning signs:**
- Code contains any `innerHTML =` or `insertAdjacentHTML(` on content derived from page text
- Grep finds `eval(`, `setTimeout(string`, or `new Function(string)` anywhere in the codebase
- Highlight logic constructs HTML strings by concatenation

**Phase to address:**
Core feature phase (Phase 2). Add a pre-commit lint rule that flags `innerHTML` assignments. This is a code review gate, not just a planning decision.

---

### Pitfall 5: Performance Degradation on Text-Heavy and Infinite-Scroll Pages

**What goes wrong:**
An aggressive `TreeWalker` scan of the full DOM runs synchronously on page load, blocking the main thread. On pages with tens of thousands of text nodes (Wikipedia, long articles, Google Docs), this causes visible jank — multi-second freezes on initial load. MutationObserver callbacks that re-trigger full-DOM scans on every DOM change (infinite scroll adds hundreds of nodes at once) create cascading CPU spikes.

**Why it happens:**
Text scanning feels fast in dev with small pages. Real-world pages (Amazon product listings, GitHub PR diffs, news aggregators) have DOM trees with 50,000+ nodes. TreeWalker at this scale is non-trivial. MutationObserver on a heavily mutating page (Twitter/X feed) can fire hundreds of times per second if not debounced.

**How to avoid:**
Always run scanning in microtask/macrotask chunks — use `requestIdleCallback()` for initial page scans so the browser can prioritize rendering. Debounce MutationObserver callbacks with a 250–500ms delay and batch-process mutations. Limit initial scan scope to `document.body` only (skip `<head>`, `<script>`, `<style>`, `<noscript>`). Cache scanned node references to avoid re-scanning unchanged subtrees. Provide a per-site disable option and a "scan on demand" mode as escape hatches for users on slow hardware.

**Warning signs:**
- Extension adds more than 200ms to Time-to-Interactive on Wikipedia-length articles (measurable with Lighthouse in extension mode)
- Chrome task manager shows extension's content script using >5% CPU on idle pages
- User reviews mention slowness or battery drain

**Phase to address:**
Core feature phase (Phase 2). Performance benchmarks against Wikipedia and a Twitter-like infinite scroll page must be part of Phase 2 completion criteria, not an afterthought.

---

### Pitfall 6: Remotely-Hosted Code Causing Instant CWS Rejection

**What goes wrong:**
Any code fetched from a remote URL and executed — even a small configuration JSON that drives behavior, a CDN-hosted utility library, or a dynamically loaded module — causes automatic CWS rejection. This includes `eval()` on fetched strings, `<script src="https://...">` injected into pages, and `import()` of external URLs.

**Why it happens:**
MV3's core security model prohibits remote code execution. The CWS automated scanner specifically looks for `eval()`, external `<script>` tags, and dynamic imports from non-extension URLs. This rule has no exceptions for legitimate use cases — it is absolute.

**How to avoid:**
Bundle everything. No CDN dependencies. No lazy-loaded modules from external sources. If a Unicode lookup table is large, embed it as a static JSON file in the extension package. Use a bundler (Vite or esbuild) configured to inline all dependencies. Verify the packed `.crx` contains all runtime dependencies before every submission.

**Warning signs:**
- Any `fetch()` call followed by `eval()` or dynamic `<script>` injection
- Dependencies loaded via unpkg, jsDelivr, or similar CDNs
- Build output references external URLs

**Phase to address:**
Build configuration phase (Phase 1). This must be enforced at the bundler level so it is physically impossible to violate — not just a developer policy.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store snippets in `chrome.storage.sync` | Sync across devices automatically | 100 KB total limit, 8 KB per item — breaks with more than ~10 large snippets | Never for user-created content; use `storage.local` for snippets |
| Scan entire DOM on every MutationObserver fire | Simpler logic, always up to date | CPU/battery destruction on SPAs with frequent DOM mutations | Never; always debounce and batch |
| Use `activeTab` only (no broad host permissions) | Faster CWS review, cleaner permission story | Users must manually trigger scan on every page; automatic detection impossible | Acceptable for MVP if auto-scan is a Phase 2+ feature |
| Hardcode Unicode range regexes as strings | Quick to write | Brittle; the Tags block (U+E0000–U+E007F) requires `\u{E0000}` with `/u` flag — string approach silently fails in non-Unicode-mode regex | Never; always use `/u` flag and Unicode escapes |
| Skip error handling on `chrome.runtime.sendMessage` | Simpler code | "Unchecked runtime.lastError" console spam; message loss when content script and service worker lifecycle are out of sync | Never; always handle `runtime.lastError` |
| Inject highlight CSS via `style` attribute | No stylesheet conflicts | CSP on the target page may block inline styles; breaks on strict-CSP sites (GitHub, banking sites) | Never; use extension-controlled stylesheet injected via `chrome.scripting.insertCSS` |

---

## Integration Gotchas

Common mistakes when connecting to external services or browser APIs.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `chrome.storage.sync` | Storing user snippets (potentially large text) in sync storage | Use `chrome.storage.local` for snippets; use `chrome.storage.sync` only for small settings objects (theme, toggle states) |
| `chrome.runtime.sendMessage` | Sending messages to tabs that have no content script (new tab page, chrome:// pages, PDF viewer) | Always catch `runtime.lastError`; check `tab.url` before messaging a tab |
| `chrome.scripting.executeScript` | Injecting into tabs without checking if the URL is injectable (chrome://, file://, Web Store pages) | Filter tab URLs before injection; `file://` requires `allow_file_access` in user settings |
| `MutationObserver` | Observing `document.body` with `subtree: true, childList: true, characterData: true` without debouncing | Debounce with 250ms minimum; only re-scan the specific subtree that changed, not the whole document |
| Content script to service worker messaging | Assuming the service worker is alive when the content script sends a message | Use `chrome.runtime.sendMessage` with error handling; the service worker may be sleeping and needs a wake event |
| Web Accessible Resources | Making all extension assets web-accessible | Declare only the minimum files needed; each web-accessible file is accessible to malicious pages on the host site |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Synchronous full-DOM TreeWalker scan on DOMContentLoaded | Visible page jank, especially on Wikipedia/long-form content | Use `requestIdleCallback` with chunk size limits (max 1000 nodes per idle slot) | Pages with >5,000 text nodes (common on news sites, documentation) |
| Re-scanning the full document on every MutationObserver callback | CPU spikes on SPAs, Twitter-like feeds become unusable | Debounce 250ms, scope re-scan to the mutated subtree only | Any page using a virtual DOM framework that re-renders on scroll/interaction |
| Storing every detected invisible character's position in memory | Memory growth on pages with thousands of hits, memory not released when navigating away | Use WeakRef or clean up on `window.pagehide` event; store only a count/summary unless user requests detail view | Pages with adversarially dense hidden Unicode (e.g., fingerprinting pages with per-character watermarks) |
| Running content script on all frames including iframes | Exponential overhead on pages with many iframes (ad-heavy sites, embedded widgets) | Add `"all_frames": false` in manifest content script declaration unless iframe scanning is a deliberate feature | Pages with 10+ iframes (news sites, advertising-heavy content) |
| Unicode regex without `/u` flag | Silent false negatives for the Tags block (U+E0000+), which requires surrogate pairs in non-Unicode mode | Always use `/[\u{E0000}-\u{E007F}]/gu` syntax with the `/u` flag | All Tags block detection — this is always wrong without the `/u` flag |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Using `innerHTML` to inject highlight markers around detected Unicode | XSS: attacker-controlled text containing `<script>` or event handler attributes executes in extension context | Use DOM API only: `document.createElement`, `textContent`, `Text.splitText` |
| Exposing sensitive extension messaging ports to host pages | Malicious page sends crafted messages to trigger privileged extension actions | Validate `sender.id === chrome.runtime.id` and `sender.url` on all incoming messages |
| Storing encoded text or snippets in `localStorage` of the host page | Malicious page scripts can read it; data exfiltrated from any site the extension touches | Store all user data exclusively in `chrome.storage` (not `window.localStorage`) |
| Making web-accessible resources broadly available | Any script on any page can fetch extension resources, potentially fingerprinting users or extracting logic | Scope `web_accessible_resources` to specific `matches` patterns; minimize the set of accessible files |
| Transmitting any data (even anonymized) via HTTP | CWS automatic rejection for "insecure transmission" (Purple Copper policy code) | Never transmit data; this extension must be fully local. If analytics are added later, HTTPS only |
| Injecting content that displays page-sourced text in extension UI without sanitization | The extension popup or side panel becomes an XSS sink if it renders page text as HTML | Always use `textContent` (never `innerHTML`) when displaying page-sourced text in extension UI |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing raw codepoints (U+E0041) to non-technical users | Confusion and distrust; users don't know if the extension is working correctly | Show human-readable labels ("Hidden tag character: Latin letter A") alongside the codepoint for technical users |
| Replacing invisible characters without undo | Users who encoded text for legitimate purposes (accessibility, Unicode art) lose their work | Implement undo via Ctrl+Z or a visible "restore original" action before any destructive replacement |
| Extension icon showing no feedback when hidden characters are found | Users don't know the extension is working; they distrust it and uninstall | Use `chrome.action.setBadgeText` to show the count of detected characters on the active tab's icon |
| Scanning automatically with no user opt-in | Users who notice CPU/battery impact immediately distrust and remove | Default to "scan on click" mode; offer "auto-scan" as an opt-in setting with a clear warning about performance |
| No per-site disable toggle | Extension breaks a website the user cares about and they must disable the whole extension | Provide per-domain disable via context menu or popup toggle; persist per-domain settings in `chrome.storage.local` |
| Encoding output that produces characters that crash clipboard APIs | Encoded text fails to paste correctly in some applications | Test clipboard round-trip in: plain text editors, Gmail compose, Slack, VS Code, Microsoft Word |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **DOM highlighting:** Often missing cleanup on navigation — verify that highlights are removed when the user navigates within an SPA (use `window.pagehide` and history API observation)
- [ ] **Unicode detection regex:** Often missing the Tags block (U+E0000–U+E007F) because it is non-BMP and requires the `/u` flag — verify detection works for both zero-width chars AND Tags block characters in a single test
- [ ] **Privacy policy:** Often a placeholder URL — verify the policy is live, accessible from the CWS listing, and specifically mentions that no browsing data leaves the device
- [ ] **Storage quota handling:** Often no error handling for `chrome.storage` quota exceeded — verify that snippet save operations surface a meaningful error to the user instead of silently failing
- [ ] **Service worker cold start:** Often tested only with a hot service worker — verify all features work correctly after `chrome://extensions` → "Inspect views: service worker" → "Stop" → triggering the feature
- [ ] **Permissions justification in CWS listing:** Often forgotten until rejection — verify the store description explicitly justifies `<all_urls>` or broad host permissions before first submission
- [ ] **Incognito mode:** Extensions do not run in incognito by default — verify the extension either works correctly in incognito (requires user opt-in in settings) or fails gracefully with a helpful message
- [ ] **Extension update mid-session:** Content scripts from old extension versions continue running after an update; the service worker is the new version — verify that message passing between old content script and new service worker does not silently break

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Service worker state loss discovered post-launch | MEDIUM | Migrate all stateful logic to `chrome.storage` reads on every handler; no architectural change needed if message handling is already async |
| DOM manipulation breaking a major site (e.g., Gmail) | MEDIUM | Add site to `exclude_matches` in a hotfix release; implement site-specific safe mode that only adds read-only badges rather than DOM mutations |
| CWS rejection for permissions | LOW–MEDIUM | Appeal with detailed justification letter; simultaneously implement optional permission request flow so reviewers can see the least-privilege alternative |
| XSS vulnerability found post-launch | HIGH | Emergency patch replacing all `innerHTML` with DOM API calls; CWS expedited review required; notify users via extension update notification |
| Performance complaints at scale | MEDIUM | Ship `requestIdleCallback` chunking and MutationObserver debounce as a patch; add "lite mode" (scan on demand only) as a user setting |
| Storage quota exceeded for sync storage | LOW | Migrate snippet storage from `chrome.storage.sync` to `chrome.storage.local`; provide migration code in the update to move existing data |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Service worker state loss | Phase 1 — Architecture | Test: stop service worker via DevTools, verify all settings survive |
| DOM manipulation breaking pages | Phase 2 — Core scanning | Integration test against Gmail, Google Docs, React/Vue SPAs before phase completion |
| Broad host permissions rejection | Phase 1 — Architecture | Permission model finalized; optional permission flow designed |
| innerHTML XSS vulnerability | Phase 2 — Core scanning | Lint rule blocking `innerHTML` in content scripts; code review gate |
| Performance on text-heavy pages | Phase 2 — Core scanning | Lighthouse benchmark on Wikipedia article; must not add >200ms TTI |
| Remotely-hosted code rejection | Phase 1 — Build setup | Bundler config verified; packed extension inspected for external URLs |
| Storage quota exceeded | Phase 2 — Storage design | Quota exceeded error handling tested; sync vs. local allocation documented |
| Missing privacy policy | Phase 4 — CWS submission prep | Privacy policy live and linked before submission; covers no-exfiltration claim |
| Message passing errors | Phase 2 — Core scanning | All `sendMessage` calls have `runtime.lastError` handling; tested after service worker sleep |
| Missing per-domain disable | Phase 3 — Settings and UX | Per-domain toggle implemented and persisted before public release |
| Unicode regex `/u` flag omission | Phase 2 — Core scanning | Unit tests covering Tags block characters (U+E0041 etc.) explicitly |
| Incognito incompatibility | Phase 4 — CWS submission prep | Incognito behavior documented in store listing; graceful degradation verified |

---

## Sources

- Chrome Developers — Extension Service Worker Lifecycle: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle (HIGH confidence — official)
- Chrome Developers — Content Scripts: https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts (HIGH confidence — official)
- Chrome Developers — Troubleshooting CWS Violations: https://developer.chrome.com/docs/webstore/troubleshooting (HIGH confidence — official)
- Chrome Developers — CWS Program Policies: https://developer.chrome.com/docs/webstore/program-policies/policies (HIGH confidence — official)
- Chrome Developers — CWS Policy Updates 2025: https://developer.chrome.com/blog/cws-policy-updates-2025 (HIGH confidence — official)
- OWASP Browser Extension Vulnerabilities Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Browser_Extension_Vulnerabilities_Cheat_Sheet.html (HIGH confidence — authoritative security reference)
- Extension Radar — Why Chrome Extensions Get Rejected: https://www.extensionradar.com/blog/chrome-extension-rejected (MEDIUM confidence — verified against official policy docs)
- DebugBear — How Chrome Extensions Impact Website Performance: https://www.debugbear.com/blog/chrome-extensions-website-performance (MEDIUM confidence — empirical measurement study)
- Chromium Extensions Group — Service Worker Lifetime Issues: https://support.google.com/chrome/thread/372388083 (MEDIUM confidence — community + official dev responses)
- Chrome Developers — Migrate to Service Workers: https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers (HIGH confidence — official migration guide)
- Knostic.ai — Zero Width Unicode Characters Risks: https://www.knostic.ai/blog/zero-width-unicode-characters-risks (MEDIUM confidence — security research, multiple corroborating sources)
- Promptfoo — Invisible Unicode Threats: https://www.promptfoo.dev/blog/invisible-unicode-threats/ (MEDIUM confidence — corroborated by Snyk/Pillar Security disclosures)

---
*Pitfalls research for: InvisibleUnicode — Chrome Extension Unicode detection/security tool*
*Researched: 2026-02-19*
