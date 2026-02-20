# Phase 6: Chrome Web Store Submission - Research

**Researched:** 2026-02-20
**Domain:** Chrome Web Store publishing, extension packaging, privacy compliance, store listing
**Confidence:** HIGH

## Summary

Chrome Web Store submission for a Manifest V3 extension with local-only processing is one of the most straightforward store submission scenarios. The extension requests only `activeTab`, `scripting`, and `storage` permissions (all well-justified), processes no user data off-device, and uses no remote code. The primary work is operational rather than technical: creating a privacy policy page, writing permission justifications, preparing store listing assets (screenshots, descriptions, promotional images), adding storage quota error handling, and packaging with `wxt zip`.

The extension's privacy-first architecture (no network calls, no data collection, sync storage for settings only) puts it in the lowest-risk category for Chrome Web Store review. The `activeTab` permission avoids the broad host permission warnings that trigger extra scrutiny. The `optional_host_permissions: ["<all_urls>"]` for auto-scan mode is properly declared as optional, which is the recommended pattern.

**Primary recommendation:** Host a static privacy policy on GitHub Pages, add try/catch with user-facing error messages around all storage writes, prepare 3-5 screenshots at 1280x800, write clear permission justifications, then use `wxt zip` to package and manually upload to the Chrome Web Store Developer Dashboard.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLAT-03 | Extension is published on Chrome Web Store | Full workflow documented: developer account setup ($5 fee), privacy policy hosting, store listing assets, permission justifications, storage error handling, `wxt zip` packaging, dashboard submission, review process (24-72 hours) |
</phase_requirements>

## Standard Stack

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| WXT CLI (`wxt zip`) | 0.20.17 | Build + zip for store submission | Already in project; `wxt zip` produces Chrome Web Store-ready .zip in `.output/` |
| WXT CLI (`wxt submit`) | 0.20.17 | Optional automated submission | Built-in; wraps `publish-browser-extension` v4.0.0 for CI/CD publishing |
| GitHub Pages | N/A | Host static privacy policy | Free, permanent URL, simple HTML/Markdown, widely used for extension privacy policies |

### Supporting

| Tool | Purpose | When to Use |
|------|---------|-------------|
| Chrome Web Store Developer Dashboard | Manual upload and listing management | First-time submission (manual is simpler than automated for v1) |
| `wxt submit init` | Interactive credential setup for automated publishing | Only if CI/CD automated publishing is desired later |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| GitHub Pages for privacy policy | Any static host (Netlify, Vercel, own domain) | GitHub Pages is free, no build step, sufficient for a single HTML page |
| Manual dashboard upload | `wxt submit` automated pipeline | Manual is simpler for first-time v1 launch; automate for frequent updates |

## Architecture Patterns

### Pattern 1: Privacy Policy as Static Page

**What:** A single HTML or Markdown page hosted at a public URL stating the extension's data practices.
**When to use:** Every Chrome Web Store submission requires a privacy policy URL.
**Key content for InvisibleUnicode:**
- Extension name and purpose
- Explicit statement: no browsing data, user text, or personal information is collected or transmitted
- Storage disclosure: `chrome.storage.sync` stores user preferences (scan mode, highlight color, snippets) locally and syncs via Chrome's built-in sync -- no third-party servers
- No analytics, no tracking, no third-party data sharing
- Contact information for the developer

**Source:** https://developer.chrome.com/docs/webstore/program-policies/privacy

### Pattern 2: Storage Quota Error Handling

**What:** Wrapping all `chrome.storage.sync` write operations in try/catch with user-facing error messages.
**When to use:** Any storage write that could exceed sync quotas.

**Sync storage limits (verified from official docs):**
- `QUOTA_BYTES`: 102,400 bytes (~100 KB total)
- `QUOTA_BYTES_PER_ITEM`: 8,192 bytes per key
- `MAX_ITEMS`: 512 items
- `MAX_WRITE_OPERATIONS_PER_MINUTE`: 120
- `MAX_WRITE_OPERATIONS_PER_HOUR`: 1,800

**Current risk assessment:** The extension stores 6 sync keys (sensitivity, wrapperEnabled, highlightColor, scanMode, primarySnippet, snippets). The snippets array is the only key likely to approach the 8,192 byte per-item limit. At ~200 bytes per snippet (name + encoded content + ID + shortcut), roughly 40 snippets would fill one item. This is unlikely to hit limits in normal use but should be guarded.

**Error handling pattern:**
```typescript
try {
  await snippetsSetting.setValue(updated);
} catch (err) {
  if (err instanceof Error && err.message.includes('QUOTA_BYTES')) {
    // Show user-facing message: "Storage full. Delete some snippets to save new ones."
  }
  throw err;
}
```

**Source:** https://developer.chrome.com/docs/extensions/reference/api/storage

### Pattern 3: Permission Justification Text

**What:** Clear, specific justification for each permission in the Chrome Web Store Developer Dashboard.
**When to use:** Required in the Privacy Practices tab for every permission in the manifest.

**Justifications for InvisibleUnicode:**

| Permission | Justification |
|------------|---------------|
| `activeTab` | Grants temporary access to the current tab only when the user clicks the extension icon or uses a keyboard shortcut. Used to inject the content script that scans the visible page for hidden Unicode characters. No background access to any other tabs or browsing history. |
| `scripting` | Required to inject the page scanner content script into the active tab. The scanner detects invisible Unicode characters (Tags block, zero-width, AI watermarks) and highlights them inline. No scripts are injected without user action. |
| `storage` | Stores user preferences (scan mode, highlight color, snippet library) using Chrome's built-in sync storage. No data is sent to external servers. Settings sync across the user's Chrome devices via Chrome's own sync infrastructure. |
| `optional_host_permissions: <all_urls>` (optional) | Only requested at runtime when the user enables "auto-scan" mode. Allows the content script to run automatically on page load. Users who prefer on-demand scanning never see this permission prompt. |

**Source:** https://developer.chrome.com/docs/webstore/cws-dashboard-privacy

### Pattern 4: Store Listing Content

**What:** Complete listing with description, screenshots, and promotional image.
**Required assets:**

| Asset | Size | Format | Required |
|-------|------|--------|----------|
| Store icon | 128x128 px | PNG | Yes (already exists at `public/icon/128.png`) |
| Small promo tile | 440x280 px | PNG/JPEG | Yes |
| Screenshots | 1280x800 px (or 640x400) | PNG/JPEG | Yes, 1-5 (aim for 3-5) |
| Marquee promo tile | 1400x560 px | PNG/JPEG | No (optional) |

**Screenshot subjects (recommended 5):**
1. Popup converter -- encode tab with text input and invisible output
2. Popup converter -- decode tab showing invisible text revealed
3. Page scanner in action -- highlighted hidden characters on a web page
4. Settings panel -- scan mode, highlight color, snippets
5. Export JSON results showing scan findings

**Source:** https://developer.chrome.com/docs/webstore/images

### Anti-Patterns to Avoid

- **Requesting unnecessary permissions:** Do NOT add `tabs`, `webNavigation`, or broad host permissions to the required permissions. The current permission set (`activeTab`, `scripting`, `storage`) is minimal and correct.
- **Using remote code or eval():** MV3 prohibits this entirely. The extension already complies (no network calls, no eval).
- **Misleading description:** Do not claim features the extension doesn't have. The single-purpose policy requires a focused description.
- **Skipping the "single purpose" field:** The privacy practices tab requires a clear single-purpose description. For InvisibleUnicode: "Detect and reveal hidden Unicode characters on web pages."

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Zip packaging | Custom build scripts | `wxt zip` | Produces store-ready zip with correct structure |
| Privacy policy hosting | Custom server | GitHub Pages (free static hosting) | Zero maintenance, always available |
| Automated publishing | Custom API scripts | `wxt submit` (wraps publish-browser-extension) | Handles OAuth, upload, and review submission |
| Store listing screenshots | Manual browser cropping | Screenshot tool at exact 1280x800 | Ensures pixel-perfect dimensions for store requirements |

## Common Pitfalls

### Pitfall 1: Rejection for Missing Permission Justification
**What goes wrong:** Extension is rejected because the developer didn't explain why each permission is needed.
**Why it happens:** The Privacy Practices tab requires individual justification text for every permission in the manifest. Leaving any blank triggers rejection.
**How to avoid:** Write specific justification text for all 4 permission entries (activeTab, scripting, storage, optional all_urls) before submission.
**Warning signs:** Dashboard shows incomplete privacy practices section.

### Pitfall 2: Missing or Inaccessible Privacy Policy
**What goes wrong:** Rejection because the privacy policy URL returns 404, is behind a login, or is a placeholder.
**Why it happens:** Privacy policy must be live at a publicly accessible URL at submission time AND at review time.
**How to avoid:** Deploy privacy policy to GitHub Pages first. Verify the URL loads in an incognito window before entering it in the dashboard.
**Warning signs:** Privacy policy URL field empty or pointing to localhost.

### Pitfall 3: Storage Quota Silent Failures
**What goes wrong:** Users save many snippets, hit the 8KB per-item limit on the snippets array, and the save silently fails.
**Why it happens:** `chrome.storage.sync.set()` rejects the promise when quota is exceeded, but without a try/catch the error is swallowed.
**How to avoid:** Wrap all storage writes in try/catch. On quota errors, show a toast/message to the user: "Storage full. Delete some snippets to save new ones."
**Warning signs:** No error handling around `snippetsSetting.setValue()` calls (current state of the codebase).

### Pitfall 4: Incorrect Version Number
**What goes wrong:** Upload rejected or confusing for users because version doesn't follow Chrome's expected format.
**Why it happens:** Chrome requires versions in the format `major.minor.patch` (e.g., `1.0.0`). The current `0.0.1` is valid but should be bumped to `1.0.0` for public release.
**How to avoid:** Update version to `1.0.0` in `package.json` and `wxt.config.ts` (WXT reads version from package.json by default).
**Warning signs:** Version in manifest is `0.0.1` which signals pre-release.

### Pitfall 5: Single Purpose Violation
**What goes wrong:** Rejection because the extension appears to serve multiple unrelated purposes.
**Why it happens:** InvisibleUnicode has both a converter (encode/decode) and a scanner (detect on pages). A reviewer might see these as two separate purposes.
**How to avoid:** Frame the single-purpose description carefully: "Detect and reveal hidden Unicode characters." The converter and scanner are both tools for the same purpose (working with invisible Unicode). The description should emphasize the unified purpose.
**Warning signs:** Store description lists features as disconnected bullet points without a unifying theme.

### Pitfall 6: Content Script on All URLs Without Justification
**What goes wrong:** The manifest declares `content_scripts` matching `<all_urls>`, which runs the content script on every page load. This can trigger extra review scrutiny.
**Why it happens:** The current manifest has `content_scripts: [{ matches: ["<all_urls>"] }]`. This is needed for auto-scan mode but runs even when the user hasn't enabled auto-scan.
**How to avoid:** This is a known architecture decision. Justify it clearly: the content script is lightweight (listens for messages), only performs scanning when triggered by user action or when auto-scan mode is enabled. Consider whether the content script could be injected programmatically instead of declaratively to reduce the permission surface.
**Warning signs:** Reviewer asks why a content script needs access to all URLs.

## Code Examples

### Storage Error Handling Wrapper

```typescript
// Wrap storage writes to catch quota exceeded errors
async function safeStorageWrite<T>(
  item: { setValue: (val: T) => Promise<void> },
  value: T,
): Promise<{ ok: true } | { ok: false; reason: 'quota' | 'unknown'; message: string }> {
  try {
    await item.setValue(value);
    return { ok: true };
  } catch (err) {
    if (err instanceof Error && err.message.includes('QUOTA_BYTES')) {
      return {
        ok: false,
        reason: 'quota',
        message: 'Storage is full. Please delete some items to free up space.',
      };
    }
    return {
      ok: false,
      reason: 'unknown',
      message: 'Failed to save. Please try again.',
    };
  }
}
```

### Privacy Policy Skeleton (HTML)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>InvisibleUnicode - Privacy Policy</title>
</head>
<body>
  <h1>Privacy Policy for InvisibleUnicode</h1>
  <p><strong>Last updated:</strong> [date]</p>

  <h2>Data Collection</h2>
  <p>InvisibleUnicode does <strong>not</strong> collect, transmit, or share any
  personal data, browsing history, or user-entered text. All processing happens
  entirely within your browser.</p>

  <h2>Storage</h2>
  <p>The extension uses Chrome's built-in sync storage to save your preferences
  (scan mode, highlight color, saved snippets). This data syncs across your
  Chrome devices through Chrome's own sync infrastructure. No data is sent to
  any third-party server.</p>

  <h2>Permissions</h2>
  <p><strong>activeTab:</strong> Temporary access to the current tab when you
  invoke the extension.</p>
  <p><strong>scripting:</strong> Injects the scanner to detect hidden Unicode
  characters on the active page.</p>
  <p><strong>storage:</strong> Saves your preferences locally.</p>

  <h2>Third Parties</h2>
  <p>No data is shared with any third party. The extension makes no network
  requests.</p>

  <h2>Contact</h2>
  <p>[Developer contact email]</p>
</body>
</html>
```

### WXT Build and Zip

```bash
# Build production output
pnpm build

# Package for Chrome Web Store upload
pnpm zip
# Output: .output/invisible-unicode-1.0.0-chrome.zip
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manifest V2 | Manifest V3 required | June 2024 (enforcement began) | MV2 extensions can no longer be published; must be MV3 |
| Self-hosted .crx distribution | Chrome Web Store only | 2015+ (policy tightened) | Chrome blocks side-loaded .crx on stable channel; store is the only distribution path |
| No privacy disclosure | Mandatory privacy practices tab | 2021 | Every extension must fill out data disclosure checkboxes and provide privacy policy URL |
| No single-purpose requirement | Single purpose required | 2014+ (strengthened over time) | Extensions must have a narrow, focused purpose explained in the dashboard |

**Deprecated/outdated:**
- MV2 submission: No longer accepted as of 2024-2025 enforcement. This extension is already MV3.
- `chrome.storage.sync` without error handling: While technically functional, the Web Store review may flag storage operations that don't handle quota errors gracefully.

## Developer Account Setup

**Prerequisites (must be completed before submission):**
1. Google account (personal or dedicated developer account)
2. One-time $5 USD developer registration fee
3. 2-Step Verification enabled on the Google account (required since 2021)
4. Agree to Chrome Web Store Developer Agreement

**Dashboard URL:** https://chrome.google.com/webstore/devconsole

**Source:** https://developer.chrome.com/docs/webstore/register

## Submission Checklist

### Before Packaging
- [ ] Version bumped to `1.0.0` in `package.json`
- [ ] Privacy policy HTML deployed to GitHub Pages and publicly accessible
- [ ] All storage writes wrapped in error handling with user-facing messages
- [ ] Store listing description written (clear single-purpose framing)
- [ ] 3-5 screenshots at 1280x800 px prepared
- [ ] Small promotional tile at 440x280 px prepared
- [ ] Store icon at 128x128 px exists (already at `public/icon/128.png`)

### During Dashboard Submission
- [ ] Upload .zip from `wxt zip` output
- [ ] Fill in detailed description
- [ ] Select primary category (likely "Productivity" or "Developer Tools")
- [ ] Enter privacy policy URL
- [ ] Fill in single-purpose description
- [ ] Write permission justification for each permission (activeTab, scripting, storage)
- [ ] Fill data disclosure: certify no personal data collected
- [ ] Select "No, I am not using remote code" for remote code declaration
- [ ] Set distribution to "Public"

### After Submission
- [ ] Review typically completes in 24-72 hours
- [ ] If rejected, review the rejection reason email and address specific issues
- [ ] Once published, verify installation from store link works

## Open Questions

1. **Content script `<all_urls>` match pattern**
   - What we know: The manifest declares `content_scripts` matching `<all_urls>`. This is needed for auto-scan but runs the content script on every page even when auto-scan is off.
   - What's unclear: Whether Chrome Web Store reviewers will flag this as excessive given that `activeTab` is also declared. The content script is lightweight (message listener only) when not scanning.
   - Recommendation: Keep as-is but prepare a strong justification. The content script only activates scanning when triggered. If rejected, consider switching to programmatic injection via `scripting.executeScript` (would require refactoring content script architecture).

2. **Store category selection**
   - What we know: The extension fits both "Developer Tools" (Unicode detection for security researchers) and "Productivity" (page scanning utility).
   - What's unclear: Which category gets better visibility for the target audience.
   - Recommendation: Use "Developer Tools" as primary category -- the security/Unicode focus aligns better with developer tool users.

3. **SCAN-05 and SCAN-08 status**
   - What we know: Two requirements (badge count, toggle highlights without reload) are still marked "Pending" in REQUIREMENTS.md.
   - What's unclear: Whether these must be completed before store submission or can be added in a post-launch update.
   - Recommendation: These are not blockers for PLAT-03 (store submission). They can ship in a v1.1 update. The extension is functional without them.

## Sources

### Primary (HIGH confidence)
- https://developer.chrome.com/docs/extensions/reference/api/storage -- sync storage quotas and error behavior
- https://developer.chrome.com/docs/webstore/cws-dashboard-privacy -- privacy practices tab fields
- https://developer.chrome.com/docs/webstore/cws-dashboard-listing -- listing requirements
- https://developer.chrome.com/docs/webstore/images -- image asset sizes and requirements
- https://developer.chrome.com/docs/webstore/program-policies/privacy -- privacy policy requirements
- https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements -- MV3 code requirements
- https://developer.chrome.com/docs/webstore/register -- developer account registration
- https://wxt.dev/api/cli/wxt-submit -- WXT submit command documentation

### Secondary (MEDIUM confidence)
- https://developer.chrome.com/docs/webstore/review-process -- review timeline (24-72 hours typical)
- https://developer.chrome.com/docs/webstore/troubleshooting -- common rejection reasons
- https://www.extensionradar.com/blog/chrome-extension-rejected -- 15 common rejection reasons with fixes

### Tertiary (LOW confidence)
- https://github.com/sindresorhus/privacy-policy/blob/main/chrome-extensions.md -- privacy policy template example (community, not official)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- WXT zip/submit are documented, Chrome Web Store requirements are well-documented official sources
- Architecture: HIGH -- no novel technical patterns; privacy policy, error handling, and store assets are standard operational work
- Pitfalls: HIGH -- rejection reasons are well-documented by Chrome team and community; storage quota limits are from official API docs

**Research date:** 2026-02-20
**Valid until:** 2026-04-20 (Chrome Web Store policies are stable; check for policy updates before submission)
