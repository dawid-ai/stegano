# InvisibleUnicode

## What This Is

A Chrome extension that converts text to invisible Unicode characters and back, while also scanning web pages to detect and reveal hidden Unicode content. It serves as both a conversion tool and a security detector for invisible prompt injection attacks. Designed for public release on the Chrome Web Store.

## Core Value

Detect and reveal hidden Unicode text on any web page so users can see what's invisible to the human eye — protecting against prompt injection and hidden content attacks.

## Requirements

### Validated

- ✓ Popup converter with encode/decode — v1.0
- ✓ Page scanner detecting Tags block, zero-width, and watermark chars — v1.0
- ✓ Configurable detection modes (always, on-demand, badge-only) — v1.0
- ✓ Inline replacement with configurable highlight colors per class — v1.0
- ✓ Stats badge on extension icon — v1.0
- ✓ Named snippets with context menu pasting — v1.0
- ✓ Auto-copy on encode option — v1.0
- ✓ Copy-to-clipboard with confirmation — v1.0
- ✓ Dark mode UI — v1.0

### Active

- [ ] Encrypt hidden text with password/key before encoding to invisible Unicode
- [ ] Custom invisible markers wrapping encrypted sections (short, unique)
- [ ] Encryption method selection with character count impact info
- [ ] Detect and visually distinguish encrypted hidden text (distinct color + label)
- [ ] Inline decryption (click encrypted highlight → enter password → see decoded text)
- [ ] Popup decrypt with password field
- [ ] Password manager in settings (save/name passwords)
- [ ] Link passwords to snippets for quick encrypted encoding
- [ ] Auto-detect encrypted content option (manual trigger by default)

### Out of Scope

- Right-click context menu encode/decode — not selected for v1, can add later
- Export/report of found hidden text — deferred, revisit after v1
- Mobile browser support — Chrome desktop only
- Other Chromium browsers (Edge, Brave) — focus on Chrome, may work but not tested
- Public-key / asymmetric encryption — too complex for the "friends sharing" use case
- Cloud-based key management — stays local per privacy constraint

## Current Milestone: v1.1 Encrypted Hidden Text

**Goal:** Add password-based encryption to invisible text so groups can hide messages that are unreadable even to those who know about invisible Unicode.

**Target features:**
- Encrypt-then-encode flow (scramble plaintext with password, then encode to invisible Unicode)
- Minimal character count overhead from encryption + markers
- Encrypted content detection with distinct visual treatment (color + label)
- Inline and popup decryption with password entry
- Password manager with ability to link passwords to snippets
- Encryption method choice with character count impact comparison

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

| Encrypt-then-encode flow | Encrypting plaintext before Tags encoding minimizes output length | — Pending |
| Separate password manager + snippet linking | Flexibility for different use cases | — Pending |
| Distinct color + label for encrypted content | Users need to visually distinguish encrypted from regular hidden text | — Pending |

---
*Last updated: 2026-03-04 after milestone v1.1 start*
