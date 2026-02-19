# InvisibleUnicode

## What This Is

A Chrome extension that converts text to invisible Unicode characters and back, while also scanning web pages to detect and reveal hidden Unicode content. It serves as both a conversion tool and a security detector for invisible prompt injection attacks. Designed for public release on the Chrome Web Store.

## Core Value

Detect and reveal hidden Unicode text on any web page so users can see what's invisible to the human eye — protecting against prompt injection and hidden content attacks.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Popup converter with encode (text → invisible Unicode) and decode (invisible → text) fields
- [ ] Page scanner that detects hidden Unicode characters (Tags block U+E0000-E007F + zero-width chars + other invisible Unicode)
- [ ] Configurable detection modes: always scan, on-demand scan, badge-only (detect without revealing)
- [ ] Inline replacement showing decoded text directly on the page with configurable highlight color/style
- [ ] Stats badge on extension icon showing count of hidden characters found on current page
- [ ] Named snippets list in settings — saved hidden Unicode strings each with a paste shortcut
- [ ] Configurable keyboard shortcuts for popup toggle and snippet quick-paste
- [ ] Copy-to-clipboard with clear confirmation message and manual copy button fallback
- [ ] Chrome Web Store-ready (manifest v3, permissions, polish)

### Out of Scope

- Right-click context menu encode/decode — not selected for v1, can add later
- Export/report of found hidden text — deferred, revisit after v1
- Mobile browser support — Chrome desktop only
- Other Chromium browsers (Edge, Brave) — focus on Chrome, may work but not tested

## Context

The Unicode Tags block (U+E0000 to U+E007F) maps directly to ASCII by adding 0xE0000 to each character code. These characters are invisible in virtually all rendering contexts but readable by software and LLMs. This makes them a vector for invisible prompt injection attacks — hiding malicious instructions in seemingly normal text.

Beyond the Tags block, other invisible Unicode characters pose similar risks: zero-width spaces (U+200B), zero-width non-joiners (U+200C), zero-width joiners (U+200D), and various other non-rendering code points.

Reference implementations:
- Wikipedia: Tags (Unicode block) — character mapping reference
- josephthacker.com/invisible_prompt_injection — simple web converter example
- embracethered.com ASCII Smuggler Tool — security-focused encoding tool

The extension needs to handle Chrome's Manifest V3 requirements (service workers, no remote code execution, declarative APIs).

## Constraints

- **Platform**: Chrome extension using Manifest V3 — required for Chrome Web Store
- **Permissions**: Minimize required permissions for Web Store approval (activeTab preferred over broad host permissions where possible)
- **Performance**: Page scanning must not noticeably slow down page load or interaction
- **Privacy**: No data leaves the browser — all conversion and detection happens locally

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Manifest V3 | Required for Chrome Web Store, future-proof | — Pending |
| Extended Unicode detection (not just Tags block) | Zero-width chars are also used for hidden content attacks | — Pending |
| Configurable detection modes | Users have different needs — always-on vs on-demand vs passive badge | — Pending |
| Inline replacement over tooltip/panel | Most direct way to see hidden content in context | — Pending |
| Local-only processing | Privacy-first, no server dependencies | — Pending |

---
*Last updated: 2026-02-19 after initialization*
