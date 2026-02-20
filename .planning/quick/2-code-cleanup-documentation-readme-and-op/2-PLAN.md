---
phase: quick
plan: 2
type: execute
wave: 1
depends_on: []
files_modified:
  - README.md
  - LICENSE
  - package.json
  - entrypoints/popup/App.tsx
  - entrypoints/popup/main.tsx
  - entrypoints/settings/App.tsx
  - entrypoints/settings/main.tsx
  - entrypoints/background.ts
  - entrypoints/content.ts
  - utils/codec.ts
  - utils/scanner.ts
  - utils/charsets.ts
  - utils/storage.ts
  - utils/messaging.ts
  - utils/clipboard.ts
  - utils/export.ts
  - utils/types.ts
  - utils/browser-shim.ts
  - wxt.config.ts
  - vitest.config.ts
  - eslint.config.mjs
autonomous: true
requirements: []
must_haves:
  truths:
    - "README.md is a proper open-source README with project description, features, install/build instructions, blog/LinkedIn links, and MIT license badge"
    - "LICENSE file exists with MIT license text"
    - "package.json has proper open-source metadata (author, license, repository, keywords)"
    - "All source files have JSDoc comments on exported functions, types, and interfaces"
    - "No dead code, unused imports, or leftover debug statements exist"
  artifacts:
    - path: "README.md"
      provides: "Open-source README"
      contains: "dawid.ai/stegano"
    - path: "LICENSE"
      provides: "MIT license file"
      contains: "MIT License"
    - path: "package.json"
      provides: "Package metadata"
      contains: "license"
---

<objective>
Clean up the entire Stegano codebase: remove dead code and unused imports, add/improve JSDoc documentation on all source files, create a proper open-source README.md, add MIT LICENSE file, and update package.json metadata.

Purpose: Prepare the project for open-source publication with professional documentation and clean code.
Output: Clean codebase with comprehensive docs, README, LICENSE, and proper package.json.
</objective>

<execution_context>
@F:/88_CODE/InvisibleUnicode/.planning/quick/2-code-cleanup-documentation-readme-and-op/2-PLAN.md
</execution_context>

<context>
@F:/88_CODE/InvisibleUnicode/package.json
@F:/88_CODE/InvisibleUnicode/README.md
@F:/88_CODE/InvisibleUnicode/wxt.config.ts
@F:/88_CODE/InvisibleUnicode/utils/codec.ts
@F:/88_CODE/InvisibleUnicode/utils/scanner.ts
@F:/88_CODE/InvisibleUnicode/utils/charsets.ts
@F:/88_CODE/InvisibleUnicode/utils/storage.ts
@F:/88_CODE/InvisibleUnicode/utils/messaging.ts
@F:/88_CODE/InvisibleUnicode/utils/clipboard.ts
@F:/88_CODE/InvisibleUnicode/utils/export.ts
@F:/88_CODE/InvisibleUnicode/utils/types.ts
@F:/88_CODE/InvisibleUnicode/utils/browser-shim.ts
@F:/88_CODE/InvisibleUnicode/entrypoints/background.ts
@F:/88_CODE/InvisibleUnicode/entrypoints/content.ts
@F:/88_CODE/InvisibleUnicode/entrypoints/popup/App.tsx
@F:/88_CODE/InvisibleUnicode/entrypoints/popup/main.tsx
@F:/88_CODE/InvisibleUnicode/entrypoints/settings/App.tsx
@F:/88_CODE/InvisibleUnicode/entrypoints/settings/main.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Code cleanup and JSDoc documentation</name>
  <files>
    entrypoints/popup/App.tsx
    entrypoints/popup/main.tsx
    entrypoints/settings/App.tsx
    entrypoints/settings/main.tsx
    entrypoints/background.ts
    entrypoints/content.ts
    utils/codec.ts
    utils/scanner.ts
    utils/charsets.ts
    utils/storage.ts
    utils/messaging.ts
    utils/clipboard.ts
    utils/export.ts
    utils/types.ts
    utils/browser-shim.ts
    wxt.config.ts
    vitest.config.ts
    eslint.config.mjs
  </files>
  <action>
    Review all source files for code quality. For each file:

    1. **Remove dead code and unused imports.** Specific things to check:
       - `ScanMatch` in `utils/types.ts` — verify it is actually imported/used anywhere. If not, remove it.
       - `CLASS_COLORS` constant in `entrypoints/content.ts` — check if still used as fallback or if the classColors parameter has fully replaced it. If dead, remove.
       - In `entrypoints/background.ts`, the `browser.action.onClicked` listener has a comment saying it is "currently dead code" since popup is set — add a clearer JSDoc explaining this is intentional (kept for when popup is removed), or remove it if truly dead.
       - Check for any `console.log` debug statements that should be removed (keep `console.error` for actual error handling).

    2. **Add/improve JSDoc comments.** Many utils files already have good module-level and function-level JSDoc. Focus on files that are MISSING them:
       - `entrypoints/popup/App.tsx` — Add a module-level JSDoc describing the popup UI (encode/decode, scan trigger, export). Add JSDoc to `handleExport`, `handleEncode`, `handleDecodeInput`, `handleCopy`, `handleScanPage`, `handleOpenSettings`.
       - `entrypoints/popup/main.tsx` — Add a brief module-level JSDoc: "Popup entry point. Mounts the Preact App component."
       - `entrypoints/settings/App.tsx` — Add module-level JSDoc describing the settings page (theme, scan mode, sensitivity, highlight colors, snippet management). Add JSDoc to key functions: `formatShortcut`, `estimateSize`, `formToShortcut`, `snippetToForm`, `handleStorageResult`, `handleThemeChange`, `handleCreate`, `handleSaveEdit`, `handleDelete`, `invisibleCharCount`.
       - `entrypoints/settings/main.tsx` — Add a brief module-level JSDoc: "Settings page entry point. Mounts the Preact App component."
       - `wxt.config.ts` — Add a module-level JSDoc describing the WXT build configuration.
       - `vitest.config.ts` — Add a brief module-level JSDoc.
       - `eslint.config.mjs` — Add a brief module-level JSDoc.

    3. **Verify existing JSDoc accuracy.** The following files already have good JSDoc — just verify their module-level comments are still accurate given the current state of the code:
       - `utils/codec.ts` (already has full JSDoc — good)
       - `utils/scanner.ts` (already has full JSDoc — good)
       - `utils/charsets.ts` (already has full JSDoc — good)
       - `utils/storage.ts` (already has full JSDoc — good)
       - `utils/messaging.ts` (already has full JSDoc — good)
       - `utils/clipboard.ts` (already has full JSDoc — good)
       - `utils/export.ts` (already has full JSDoc — good)
       - `utils/types.ts` (already has full JSDoc — good)
       - `utils/browser-shim.ts` (already has full JSDoc — good)
       - `entrypoints/background.ts` (already has full JSDoc — good)
       - `entrypoints/content.ts` (already has full JSDoc — good)

    Do NOT change any functionality. Only add documentation and remove dead code/unused imports.
  </action>
  <verify>
    Run `pnpm compile` (TypeScript type-check) to verify no imports were broken.
    Run `pnpm test` to verify no functionality changed.
    Run `pnpm lint` to verify no ESLint violations.
  </verify>
  <done>All source files have accurate JSDoc comments on exports. No unused imports or dead code remain. All checks pass.</done>
</task>

<task type="auto">
  <name>Task 2: Create README.md, LICENSE, and update package.json</name>
  <files>
    README.md
    LICENSE
    package.json
  </files>
  <action>
    1. **Create LICENSE file** with MIT license text. Copyright holder: "Dawid Jozwiak". Year: 2025.

    2. **Update package.json** metadata:
       - Change `"private": true` to `"private": false` (open-source publishing)
       - Add `"author": "Dawid Jozwiak (https://dawid.ai)"`
       - Add `"license": "MIT"`
       - Add `"repository": { "type": "git", "url": "https://github.com/dawidjozwiak/stegano" }` (use this as placeholder — user can update the actual URL)
       - Add `"homepage": "https://dawid.ai/stegano"`
       - Add `"keywords": ["chrome-extension", "unicode", "steganography", "invisible-text", "prompt-injection", "ascii-smuggling", "security", "red-team"]`
       - Keep all existing fields (name, description, version, type, scripts, dependencies, devDependencies) unchanged.

    3. **Rewrite README.md** as a proper open-source README. Structure:

       **Header:** Project name "Stegano" with a one-line tagline. Add MIT license badge.

       **Description paragraph:** Chrome extension for detecting and revealing hidden Unicode characters on any web page. Protect against prompt injection, ASCII smuggling, and invisible text attacks. Also includes an encoder/decoder for creating your own invisible messages using Unicode Tags block steganography.

       **Features section** (bulleted list):
       - On-demand page scanning with inline highlighting
       - Three detection sensitivity levels (Standard, Thorough, Paranoid)
       - Tags block decoding — reveals hidden ASCII encoded in Unicode Tags (U+E0000-E007F)
       - Zero-width character labeling with Unicode code points
       - AI watermark detection (narrow spaces used by LLM providers)
       - Encode/decode tool in popup for creating invisible messages
       - Snippet library with keyboard shortcuts for quick-paste
       - Per-class customizable highlight colors (tags=yellow, zero-width=orange, watermark=pink)
       - Dark mode support
       - JSON export of scan findings
       - MutationObserver for dynamically loaded content
       - All processing is local-only — no data leaves the device

       **Screenshots/Usage section:** Add placeholder text "Screenshots coming soon" with a brief usage description: install, click the extension icon, click "Scan Page", hidden characters are highlighted inline. Mention the encode/decode tool in the popup.

       **Installation section:**
       ```
       Prerequisites: Node.js 18+, pnpm
       git clone <repo-url>
       cd stegano
       pnpm install
       ```

       **Development section:**
       ```
       pnpm dev          # WXT dev server with hot reload
       pnpm build        # Production build
       pnpm test         # Run tests
       pnpm compile      # TypeScript type-check
       pnpm lint         # ESLint
       ```

       **Loading in Chrome:**
       1. Run `pnpm build`
       2. Open `chrome://extensions`, enable Developer mode
       3. Click "Load unpacked", select `.output/chrome-mv3`

       **Architecture section:** Brief overview of the tech stack (WXT, Preact, TypeScript, Tailwind CSS 4, Vitest) and a table of key files/directories similar to the current README but updated to reflect the full codebase:
       | Path | Purpose |
       | utils/codec.ts | Encode/decode between ASCII and Tags block Unicode |
       | utils/scanner.ts | Pure scanner: findInvisibleChars, decodeTagsRun |
       | utils/charsets.ts | Sensitivity presets and detection regex builder |
       | utils/storage.ts | Typed storage items (sync storage) |
       | utils/messaging.ts | Type-safe background/content script messaging |
       | utils/clipboard.ts | Clipboard API with execCommand fallback |
       | utils/export.ts | Scan report builder for JSON export |
       | utils/types.ts | Shared TypeScript types |
       | entrypoints/background.ts | Service worker: scan toggle, badge, shortcuts |
       | entrypoints/content.ts | Content script: DOM scanning, highlighting |
       | entrypoints/popup/ | Popup UI: encode/decode, scan trigger |
       | entrypoints/settings/ | Settings page: preferences, snippet manager |

       **Privacy section:** One paragraph: all processing is local-only, no network calls, no analytics, no data collection.

       **Links section:**
       - Blog post: [dawid.ai/stegano](https://dawid.ai/stegano)
       - Author: [Dawid Jozwiak](https://www.linkedin.com/in/jozwiakdawid/) on LinkedIn

       **License section:** MIT — see LICENSE file.

       Keep the README clean and scannable. No emojis. Use standard Markdown formatting.
  </action>
  <verify>
    Verify README.md contains: project description, features list, install instructions mentioning pnpm and WXT, dawid.ai/stegano link, LinkedIn link, MIT license reference.
    Verify LICENSE file exists and contains "MIT License" and "Dawid Jozwiak".
    Verify package.json parses as valid JSON: `node -e "require('./package.json')"` from project root.
  </verify>
  <done>README.md is a complete open-source README with all required sections. LICENSE file has MIT text. package.json has author, license, repository, homepage, and keywords fields.</done>
</task>

</tasks>

<verification>
- `pnpm compile` passes (no TypeScript errors from cleanup)
- `pnpm test` passes (no functionality changed)
- `pnpm lint` passes (no ESLint violations)
- README.md contains dawid.ai/stegano and LinkedIn URL
- LICENSE file exists with MIT license
- package.json has license, author, homepage, keywords fields
</verification>

<success_criteria>
- All 15 source files have JSDoc on exported functions/types
- No unused imports or dead code
- README.md is a professional open-source README
- LICENSE (MIT) exists
- package.json has proper open-source metadata
- All existing tests still pass
</success_criteria>

<output>
After completion, create `.planning/quick/2-code-cleanup-documentation-readme-and-op/2-SUMMARY.md`
</output>
