# Feature Research

**Domain:** Chrome Extension — Unicode invisible character converter and page scanner
**Researched:** 2026-02-19
**Confidence:** MEDIUM (competitive landscape is thin; most findings come from WebSearch + live competitor analysis, verified against Chrome Web Store listings and GitHub repos)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Popup encoder: paste text → get invisible-encoded output | Core utility; every comparable tool (StegZero, InvisibleTextEncoder) starts here | LOW | Must be instant, no round-trips; all processing local |
| Popup decoder: paste invisible text → get plaintext back | Symmetric pair with encoder; users arrive expecting both | LOW | Must handle mixed content (visible + hidden chars) gracefully |
| Copy-to-clipboard button on output | Every text-tool extension does this; absence is noticed immediately | LOW | One-tap; show brief "Copied!" confirmation |
| Support for zero-width characters (ZWS, ZWNJ, ZWJ, U+200B–U+200F) | These are the well-known invisible chars; the domain's "basic" tier | LOW | Well-documented, widely used for fingerprinting detection |
| Support for Unicode Tags block (U+E0000–U+E007F) | Increasingly prominent in AI-watermarking, prompt injection, ASCII smuggling; users seek this specifically | MEDIUM | Less common in existing extensions — detection gap exists |
| Page scanner: detect and flag invisible Unicode on the current page | Primary security use case; Hacker News thread showed strong demand for automatic detection | HIGH | Must handle large DOM trees without freezing; use `document_idle` injection |
| Visual highlight of detected characters in-page | Detection without visibility is useless; users expect to *see where* hidden chars live | MEDIUM | Wrap offending text nodes in a styled `<mark>` or inline `<span>` |
| Extension icon badge showing detected-character count | Ad-blocker UX pattern; users explicitly requested this in the 2018 HN thread and it remains expected | LOW | Use `chrome.action.setBadgeText()`; update on page load |
| Clear/reset button in popup | Needed for iterative encode/decode workflows | LOW | — |
| Privacy-first / fully local processing | Users in this space are security-aware; remote processing is a trust-killer | LOW | Enforce in architecture; mention explicitly in store listing |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Configurable scan modes (always-on / on-demand / badge-only) | Existing extensions force one mode; users have different risk tolerances and performance needs | MEDIUM | Persist setting in `chrome.storage.sync`; badge-only is lowest perf impact |
| AI watermark detection mode (U+202F, U+200B, Em-Space patterns) | Hot topic in 2024–2025; GPT-o3/o4-mini insert narrow no-break spaces; no dedicated extension covers this yet | MEDIUM | Needs a curated character list with named labels (e.g. "AI watermark candidate") |
| Inline text replacement with configurable highlight color | Existing extensions highlight the container element, not the specific character; InvisibleUnicode can highlight at character level | MEDIUM | DOM surgery on text nodes; must not break emoji ZWJ sequences |
| Saved snippets library with paste shortcuts | No competitor in this niche has snippet management; borrowing a UX pattern from Text Blaze that's proven valued | MEDIUM | Store in `chrome.storage.local`; keyboard shortcut triggers popup insert |
| Configurable keyboard shortcuts (encode/decode/scan) | Power users want hands-free workflows; encoder extensions rarely expose shortcuts | LOW | Use `chrome.commands` API; document in extension options |
| Character-level breakdown in scan results (name, codepoint, count, location) | Existing extensions show "zero-width chars found" without specifics; developers need codepoint details | MEDIUM | Display U+XXXX, Unicode name, frequency; group by type |
| Non-destructive page reveal mode (toggle highlights without page reload) | Lets users compare before/after; no competitor offers toggle-off | LOW | Track injected spans; remove on toggle-off |
| Export scan report (copy to clipboard or download JSON) | Security researchers and developers want a record; unique in this space | LOW | Serialize findings to JSON; offer clipboard or `<a download>` |
| Tags block vs zero-width char discrimination | Most extensions treat all invisible chars the same; distinguishing Tags block (steganography/AI injection) from ZW chars (fingerprinting/formatting) is actionable intelligence | LOW | Categorize at detection time; show separate counts in badge tooltip |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Automatic stripping / removal of invisible chars from all pages | Users want to "just clean everything" | Breaks legitimate Unicode uses: emoji skin tones (ZWJ), Arabic shaping (ZWNJ), language joiners; causes rendering corruption; users will report bugs on every site with compound emoji | Offer opt-in "sanitize this text field" in popup, not page-wide auto-strip |
| Cloud sync of snippets / encoded text | Convenience for multi-device use | The extension's core trust proposition is local-only; syncing to a server contradicts the privacy-first brand and creates a data liability | Use `chrome.storage.sync` (syncs via Chrome account without a separate server); document that no Anthropic/third-party server is involved |
| Real-time character-by-character scan as user types | Feels powerful | High performance cost on heavy pages; content scripts observing every keystroke will cause jank; Chrome may throttle or flag | Scan on-demand or on page load, not on input events |
| LLM integration ("AI-powered explain this hidden text") | Seems like a natural upsell | Requires sending user text to an external API, directly violating the privacy-first promise; trust damage outweighs convenience | Ship local decode + codepoint lookup table; no external API needed |
| Firefox / Safari port at launch | Requested immediately when any Chrome-only extension ships | Cross-browser porting during initial development splits focus; Manifest V3 differences between browsers add bugs; Web Store review is already a bottleneck | Ship Chrome first, validate demand, then port (use WebExtensions API from day one to keep the door open) |
| OAuth login / user accounts | Seems useful for premium features | Massive complexity addition; breaks privacy promise; alienates security-conscious users | Keep it local; use `chrome.storage.sync` for settings persistence |

---

## Feature Dependencies

```
[Page Scanner]
    └──requires──> [Content Script Injection]
                       └──requires──> [Manifest V3 content_scripts declaration]

[Inline Highlight]
    └──requires──> [Page Scanner]
                       └──requires──> [Content Script Injection]

[Badge Count]
    └──requires──> [Page Scanner]
    └──uses──> [chrome.action.setBadgeText]

[Configurable Scan Mode]
    └──requires──> [Page Scanner]
    └──uses──> [chrome.storage.sync]

[AI Watermark Detection Mode]
    └──requires──> [Page Scanner]
    └──enhances──> [Character-level breakdown]

[Saved Snippets]
    └──uses──> [chrome.storage.local]
    └──enhances──> [Popup Encoder]

[Keyboard Shortcuts]
    └──uses──> [chrome.commands API]
    └──enhances──> [Popup Encoder] and [Popup Decoder] and [Page Scanner]

[Export Scan Report]
    └──requires──> [Page Scanner]
    └──requires──> [Character-level breakdown]

[Non-destructive Toggle]
    └──requires──> [Inline Highlight]

[Tags Block Detection]
    └──requires──> [Page Scanner]
    └──conflicts──> [Auto-strip] (stripping Tags chars may corrupt legitimate emoji variant sequences in edge cases)
```

### Dependency Notes

- **Page Scanner requires Content Script Injection:** The scanner must run in the page's DOM context; the service worker (background) cannot access the DOM in Manifest V3.
- **Inline Highlight requires Page Scanner:** You cannot highlight what you have not found; the scanner's findings feed the highlight pass.
- **Badge Count requires Page Scanner:** The count is derived from scan output; a badge-only mode still runs the full scan, it just skips DOM mutation.
- **Configurable Scan Mode requires chrome.storage.sync:** Mode preference must persist across sessions and sync across devices without a server.
- **Tags Block Detection conflicts with Auto-strip:** U+E0000 characters have no legitimate rendering use, so stripping them is safe — but implementing an auto-strip that is safe for Tags and unsafe for ZWJ requires per-character-class logic. Implement targeted removal, not bulk removal.
- **Saved Snippets enhances Popup Encoder:** Snippets are pre-encoded strings that bypass the encode step; they depend on the popup UI but not on the encode logic being invoked each time.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept and earn Chrome Web Store reviews.

- [ ] Popup encoder (text → Tags block + zero-width invisible output) — core promise, must work on day one
- [ ] Popup decoder (invisible text → plaintext) — symmetric and expected; absence causes immediate 1-star reviews
- [ ] Copy-to-clipboard button with confirmation — UX baseline; every comparable tool has it
- [ ] Page scanner with on-demand trigger (button click) — security use case; differentiates from pure converter tools
- [ ] In-page highlight of detected characters — detection without visibility is useless
- [ ] Extension icon badge count — visual feedback loop; explicitly requested by users in community research
- [ ] Support both character classes: ZW chars AND Tags block — competitors cover only ZW; Tags block is the differentiation gap
- [ ] Fully local processing with no network calls — trust foundation; must be architecturally enforced from day one

### Add After Validation (v1.x)

Features to add once core is working and first user feedback arrives.

- [ ] Configurable scan modes (always-on / on-demand / badge-only) — add when users complain about performance or request "auto-scan"
- [ ] AI watermark detection mode with named character labels — add when AI watermarking is raised in reviews or issues
- [ ] Saved snippets library — add when users ask for repeated-use invisible text patterns
- [ ] Character-level breakdown in scan results (U+XXXX, name, count) — add when developer/security users request details
- [ ] Keyboard shortcuts for encode/decode/scan — add when power users request it; low effort once popup is stable

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Export scan report (JSON/clipboard) — useful for security researchers; defer until that segment is confirmed active
- [ ] Non-destructive toggle (on/off highlights without reload) — polish feature; only valuable after scanner adoption
- [ ] Configurable highlight color — cosmetic preference; defer until users request it specifically
- [ ] Firefox port — valid long-term goal; defer to avoid splitting development focus at launch

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Popup encoder (Tags + ZW) | HIGH | LOW | P1 |
| Popup decoder | HIGH | LOW | P1 |
| Copy-to-clipboard | HIGH | LOW | P1 |
| Page scanner (on-demand) | HIGH | MEDIUM | P1 |
| In-page highlight | HIGH | MEDIUM | P1 |
| Badge count | HIGH | LOW | P1 |
| Local-only processing | HIGH | LOW | P1 |
| Tags block + ZW discrimination | MEDIUM | LOW | P1 |
| Configurable scan modes | MEDIUM | MEDIUM | P2 |
| AI watermark detection mode | HIGH | LOW | P2 |
| Character-level breakdown | MEDIUM | MEDIUM | P2 |
| Saved snippets | MEDIUM | MEDIUM | P2 |
| Keyboard shortcuts | MEDIUM | LOW | P2 |
| Export scan report | LOW | LOW | P3 |
| Non-destructive toggle | MEDIUM | LOW | P3 |
| Configurable highlight color | LOW | LOW | P3 |
| Firefox port | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Detect Zero-Width Chars (Chrome) | Invisible Characters Tool (Chrome) | StegZero (web) | InvisibleUnicode (our approach) |
|---------|----------------------------------|-------------------------------------|----------------|----------------------------------|
| Encode to invisible | No | No | Yes (ZW only) | Yes (Tags + ZW) |
| Decode from invisible | No | No | Yes (ZW only) | Yes (Tags + ZW) |
| Page scanner | Yes (ZW only) | Yes (limited) | No | Yes (Tags + ZW) |
| Auto-scan on page load | Unknown | No | N/A | Configurable |
| Inline character highlight | Element-level only | Unknown | N/A | Character-level |
| Badge count | No | No | N/A | Yes |
| Tags block (U+E0000) support | No | No | No | Yes |
| AI watermark detection | No | No | No | Yes (v1.x) |
| Saved snippets | No | No | No | Yes (v1.x) |
| Keyboard shortcuts | No | No | N/A | Yes (v1.x) |
| Scan mode options | No | No | N/A | Yes (v1.x) |
| Export scan report | No | No | No | Yes (v2) |
| Local processing | Yes | Yes | Yes | Yes |

**Key competitive gap:** No existing Chrome extension covers the Unicode Tags block (U+E0000–U+E007F) for both encoding/decoding AND in-page detection. This is the primary differentiator. The AI watermarking angle (detecting LLM-inserted narrow no-break spaces) is a second gap that no competitor addresses.

---

## Sources

- [Detect Zero-Width Characters — Chrome Web Store](https://chromewebstore.google.com/detail/detect-zero-width-charact/icibkhaehdofmcbfjfpppogioidkilib) — competitor feature set (MEDIUM confidence; Chrome Web Store listing)
- [Invisible Characters Tool — Chrome Web Store](https://chromewebstore.google.com/detail/invisible-characters-tool/gillenphlpiglhjfnjjomkegcijppigg) — competitor feature set (MEDIUM confidence)
- [GitHub: detect-zero-width-characters-chrome-extension](https://github.com/roymckenzie/detect-zero-width-characters-chrome-extension) — open-source competitor architecture (HIGH confidence; source code)
- [Show HN: I made a Chrome extension to reveal zero-width characters — Hacker News](https://news.ycombinator.com/item?id=16754987) — user feature requests and pain points (MEDIUM confidence; community discussion)
- [StegZero — Unicode Steganography](https://stegzero.com/) — encoder/decoder feature baseline (HIGH confidence; live tool)
- [ASCII Smuggler Tool — embracethered.com](https://embracethered.com/blog/posts/2024/hiding-and-finding-text-with-unicode-tags/) — Tags block U+E0000 use cases and security context (HIGH confidence; security research)
- [Google Chrome Extension Detects Zero-Width Character Fingerprinting — BleepingComputer](https://www.bleepingcomputer.com/news/security/google-chrome-extension-detects-zero-width-character-fingerprinting-attacks/) — security use case validation (MEDIUM confidence; tech journalism)
- [Invisible Text Detector & Remover — Originality.AI](https://originality.ai/blog/invisible-text-detector-remover) — AI watermarking context and user demand (MEDIUM confidence; industry tool)
- [New ChatGPT Models Leave Watermarks — RumiDocs](https://www.rumidocs.com/newsroom/new-chatgpt-models-seem-to-leave-watermarks-on-text) — AI watermark character patterns (LOW confidence; single source, unverified)
- [Hidden text fingerprints and how to avoid them — Medium/Aidan Breen](https://medium.com/@aidobreen/hidden-text-fingerprints-and-how-to-avoid-them-d0103edd2ce4) — fingerprinting use case (MEDIUM confidence)
- [Glyph Suite — Unicode Steganography Tools](https://riley-coyote.github.io/glyph/) — Tags block detection features (MEDIUM confidence; live tool)
- [Minimize extension impact on page load time — Microsoft Edge Docs](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/minimize-page-load-time-impact) — content script performance guidance (HIGH confidence; official docs)

---
*Feature research for: Chrome Extension Unicode security/converter tools (InvisibleUnicode)*
*Researched: 2026-02-19*
