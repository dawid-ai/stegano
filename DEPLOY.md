# Stegano — Chrome Web Store Deployment Guide

## Prerequisites

- Google Chrome Developer account ($5 one-time registration fee)
  - Register at: https://chrome.google.com/webstore/devconsole
- Privacy policy hosted at a public URL
- Extension `.zip` package built and ready

## Step 1: Deploy the Privacy Policy

The privacy policy lives at `docs/privacy-policy.html`. Host it publicly:

### Option A: GitHub Pages (recommended)

```bash
# From your repo root
git checkout -b gh-pages
git push origin gh-pages
```

Then in your GitHub repo → Settings → Pages:
- Source: Deploy from branch `gh-pages`
- Folder: `/docs`

Your privacy policy will be at:
```
https://YOUR_USERNAME.github.io/InvisibleUnicode/privacy-policy.html
```

### Option B: Direct file hosting

Upload `docs/privacy-policy.html` to any static host (Netlify, Vercel, Cloudflare Pages, your own domain).

### Verify

Open the URL in an **incognito window** — it must load without authentication.

## Step 2: Build the Extension Package

```bash
pnpm build
pnpm zip
```

Output: `.output/stegano-1.0.0-chrome.zip` (or `invisible-unicode-1.0.0-chrome.zip`)

Verify the manifest:
```bash
cat .output/chrome-mv3/manifest.json | grep -E "name|version"
```

Expected: `"name": "Stegano"`, `"version": "1.0.0"`

## Step 3: Prepare Screenshots

Capture **3–5 screenshots** at exactly **1280x800 pixels**:

1. **Popup — Scan button and encode** — Show the main popup with the "Scan Page" button and an encoded message
2. **Page scan results** — A web page with highlighted hidden characters (yellow for Tags block, orange for zero-width, pink for AI watermarks)
3. **Settings page** — Show scan mode selector, sensitivity picker, highlight color, and snippet management
4. **Decode in action** — Paste invisible Unicode in the decode field showing revealed text
5. **Badge count** — Extension icon showing red badge with finding count on a scanned page

Tips:
- Use Chrome DevTools → Toggle device toolbar → set to 1280x800
- Or use a screenshot tool that crops to exact dimensions
- Show real content — scan a page with actual hidden Unicode embedded

## Step 4: Chrome Web Store Submission

Go to: https://chrome.google.com/webstore/devconsole

Click **"New Item"** → Upload the `.zip` file.

### Listing Tab

**Title:** `Stegano`

**Summary (132 chars max):**
```
AI Red Team tool — hide and detect invisible Unicode in any web page. Test prompt injection attacks and find hidden text.
```

**Detailed Description:**
```
Stegano is an AI Red Team toolkit for testing invisible prompt injection attacks using Unicode steganography.

Security researchers and AI engineers use invisible Unicode characters to hide instructions inside seemingly normal text — a technique known as "ASCII Smuggling" or "Unicode Smuggling." These hidden payloads can manipulate LLMs, bypass content filters, and inject prompts that are invisible to human reviewers.

Stegano lets you both create and detect these attacks:

HIDE (Encode)
- Convert any text to invisible Unicode using the Tags block (U+E0000–U+E007F)
- Paste hidden instructions into prompts, documents, LinkedIn posts, or web pages
- Test whether your AI systems are vulnerable to invisible prompt injection

DETECT (Scan)
- Scan any web page for hidden Unicode characters with one click
- Three detection classes with color-coded highlighting:
  → Yellow: Tags block encoded messages (ASCII Smuggling)
  → Orange: Zero-width characters (U+200B–U+200F)
  → Pink: AI watermark indicators (U+202F, narrow spaces)
- Three sensitivity levels: Standard, Thorough, Paranoid
- Automatic or on-demand scanning modes

FEATURES
- Configurable keyboard shortcuts (Alt+Shift+S to scan)
- Named snippet library with quick-paste shortcuts
- Export scan results as JSON
- Customizable highlight colors
- Settings sync across devices

PRIVACY
- All processing happens locally in your browser
- No data is collected, transmitted, or shared — ever
- No network requests, no analytics, no tracking
- Open source: https://dawid.ai/stegano

Built for penetration testers, AI red teams, security researchers, and anyone who wants to see what's hidden in plain text.
```

**Category:** Developer Tools

**Language:** English

### Privacy Practices Tab

**Single purpose description:**
```
Detect and reveal hidden Unicode characters on web pages, and encode/decode invisible text for security testing.
```

**Permission justifications:**

| Permission | Justification |
|-----------|---------------|
| `activeTab` | Grants temporary access to the current tab only when the user clicks the extension icon or uses a keyboard shortcut. Used to inject the content script that scans the visible page for hidden Unicode characters. No background access to any tabs or browsing history. |
| `scripting` | Required to inject the page scanner content script into the active tab. The scanner detects invisible Unicode characters (Tags block, zero-width, AI watermarks) and highlights them inline. No scripts are injected without user action. |
| `storage` | Stores user preferences (scan mode, highlight color, snippet library) using Chrome's built-in sync storage. No data is sent to external servers. Settings sync across the user's Chrome devices via Chrome's own sync infrastructure. |

**Data disclosure:**
- [x] I certify that NO personal data is collected
- Remote code: **No, I am not using remote code**
- Privacy policy URL: `[your deployed URL from Step 1]`

### Distribution Tab

- Visibility: **Public**
- Distribution: **All regions**

## Step 5: Submit for Review

Click **"Submit for review"**.

Typical review time: **24–72 hours**.

### If Rejected

Common rejection reasons and fixes:

| Reason | Fix |
|--------|-----|
| "Permission not justified" | Expand the permission justification text |
| "Missing privacy policy" | Verify the privacy policy URL loads in incognito |
| "Single purpose violation" | Clarify that encode/decode and scanning serve the same purpose (invisible Unicode security) |
| "Misleading functionality" | Ensure screenshots accurately represent the extension |

## Step 6: Post-Publication

After approval:

1. Copy the Chrome Web Store listing URL
2. Update `docs/privacy-policy.html` contact email (replace placeholder)
3. Update the blog post at dawid.ai with the store link
4. Share the extension link

### Updating the Extension

```bash
# Bump version in package.json
# Make changes
pnpm build && pnpm zip
# Upload new .zip in Developer Dashboard → your extension → Package
```

Chrome Web Store auto-updates installed extensions within 24 hours.
