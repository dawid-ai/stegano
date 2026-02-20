---
phase: quick-1
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - entrypoints/popup/App.tsx
  - entrypoints/popup/style.css
  - entrypoints/settings/App.tsx
  - entrypoints/settings/style.css
  - utils/storage.ts
  - utils/scanner.ts
  - entrypoints/content.ts
autonomous: true
requirements: [DARK-MODE, SETTINGS-UI-FIXES, CHAR-CODES]

must_haves:
  truths:
    - "Settings page and popup render in dark mode by default"
    - "Settings page has a theme dropdown (dark/light) that persists across sessions"
    - "Clear All button is removed from the popup header"
    - "Settings cog icon in popup header is visibly larger (at least text-base or bigger)"
    - "Settings page shows 3 separate color pickers for tags, zerowidth, and watermark classes"
    - "Zero-width character highlights on scanned pages show both a name and U+XXXX code"
    - "Watermark character highlights show both the named label and U+XXXX code"
  artifacts:
    - path: "utils/storage.ts"
      provides: "themeSetting and per-class color settings"
      contains: "themeSetting"
    - path: "entrypoints/settings/App.tsx"
      provides: "Theme dropdown and 3 color pickers"
    - path: "entrypoints/popup/App.tsx"
      provides: "Dark mode support, larger cog, no Clear All button"
    - path: "utils/scanner.ts"
      provides: "Unicode code in all replacement labels"
  key_links:
    - from: "entrypoints/settings/App.tsx"
      to: "utils/storage.ts"
      via: "themeSetting, per-class color settings"
      pattern: "themeSetting|tagsColorSetting|zerowColorSetting|watermarkColorSetting"
    - from: "entrypoints/content.ts"
      to: "utils/storage.ts"
      via: "per-class color settings"
      pattern: "tagsColorSetting|zerowColorSetting|watermarkColorSetting"
---

<objective>
Add dark mode (default), per-class highlight color settings, Unicode code display for all invisible characters, and clean up the popup UI by removing the broken Clear All button and enlarging the settings cog.

Purpose: Improve usability with dark mode default (easier on eyes for security tool), give users granular control over highlight colors per character class, and show Unicode codes so users understand exactly what invisible character they are looking at.
Output: Updated popup, settings, storage, scanner, and content script files.
</objective>

<execution_context>
@F:/88_CODE/InvisibleUnicode/.planning/STATE.md
</execution_context>

<context>
@F:/88_CODE/InvisibleUnicode/entrypoints/popup/App.tsx
@F:/88_CODE/InvisibleUnicode/entrypoints/popup/style.css
@F:/88_CODE/InvisibleUnicode/entrypoints/settings/App.tsx
@F:/88_CODE/InvisibleUnicode/entrypoints/settings/style.css
@F:/88_CODE/InvisibleUnicode/utils/storage.ts
@F:/88_CODE/InvisibleUnicode/utils/scanner.ts
@F:/88_CODE/InvisibleUnicode/entrypoints/content.ts
@F:/88_CODE/InvisibleUnicode/utils/charsets.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add dark mode with theme setting and per-class color storage</name>
  <files>
    utils/storage.ts
    entrypoints/popup/style.css
    entrypoints/settings/style.css
    entrypoints/popup/App.tsx
    entrypoints/settings/App.tsx
  </files>
  <action>
1. In `utils/storage.ts`, add new storage items:
   - `themeSetting` — `storage.defineItem<'dark' | 'light'>('sync:theme', { fallback: 'dark' })` (dark is default)
   - `tagsColorSetting` — `storage.defineItem<string>('sync:tagsColor', { fallback: '#FFEB3B' })` (yellow)
   - `zerowColorSetting` — `storage.defineItem<string>('sync:zerowColor', { fallback: '#FF9800' })` (orange)
   - `watermarkColorSetting` — `storage.defineItem<string>('sync:watermarkColor', { fallback: '#E91E63' })` (pink)
   - Keep the existing `highlightColorSetting` as-is for backward compatibility, but it will no longer be the primary UI control. Consider it a legacy/custom override.

2. In `entrypoints/popup/style.css` and `entrypoints/settings/style.css`, add Tailwind v4 dark mode support:
   - Add `@custom-variant dark (&.dark);` so dark mode is driven by the `.dark` class on the root element (not OS preference, since user picks in settings).
   - In popup/style.css, keep the existing body width/height rules.

3. In `entrypoints/popup/App.tsx`:
   - Import `themeSetting` from storage.
   - On mount, read `themeSetting.getValue()` and apply `.dark` class to `document.documentElement`. Watch for changes too.
   - Update the root div from `bg-gray-50` to `bg-gray-50 dark:bg-gray-900` and similarly update all text colors, borders, inputs, buttons to have dark variants. Use Tailwind dark: prefix throughout.
   - Specific dark classes needed:
     - Background: `bg-gray-50 dark:bg-gray-900`
     - Text: `text-gray-800 dark:text-gray-100`, `text-gray-600 dark:text-gray-400`, `text-gray-500 dark:text-gray-400`, `text-gray-400 dark:text-gray-500`
     - Borders: `border-gray-200 dark:border-gray-700`, `border-gray-300 dark:border-gray-600`
     - Inputs/textareas: `bg-white dark:bg-gray-800` for editable, `bg-gray-100 dark:bg-gray-800` for readonly
     - Buttons: `bg-gray-200 dark:bg-gray-700` for kbd elements
     - The scan button colors (indigo/red) work fine in both modes, keep as-is.
   - **Remove the "Clear All" button entirely** — the `handleClear` function and the button element that calls it. The function clears encode/decode fields but is confusing in the header next to Export JSON. Users can just clear inputs manually.
   - **Make the settings cog bigger**: Change the cog button from `text-xs` to `text-lg` and increase padding slightly (`px-1.5 py-0.5`). Keep the gear entity `&#9881;`.

4. In `entrypoints/settings/App.tsx`:
   - Import `themeSetting`, `tagsColorSetting`, `zerowColorSetting`, `watermarkColorSetting` from storage.
   - On mount, read theme setting and apply `.dark` class to `document.documentElement`. Watch for changes.
   - Add a "Theme" dropdown in the General Settings section (above Scan Mode) with options "Dark" (value: 'dark') and "Light" (value: 'light'). On change, save to `themeSetting` and toggle `.dark` class on `document.documentElement`.
   - Replace the single "Highlight Color" picker with three separate color pickers:
     - "Tags Block Color" — bound to `tagsColorSetting`, default yellow (#FFEB3B), reset button
     - "Zero-Width Color" — bound to `zerowColorSetting`, default orange (#FF9800), reset button
     - "Watermark Color" — bound to `watermarkColorSetting`, default pink (#E91E63), reset button
   - Remove the old single `highlightColor` state and its picker. Remove the import of `highlightColorSetting` from settings (it stays in storage.ts for backward compat but is no longer shown in settings UI).
   - Apply dark mode Tailwind classes to all elements, same pattern as popup:
     - `bg-gray-50 dark:bg-gray-900` for page background
     - `bg-white dark:bg-gray-800` for card sections
     - `border-gray-200 dark:border-gray-700` for borders
     - `text-gray-800 dark:text-gray-100` for headings
     - `text-gray-600 dark:text-gray-400` for labels
     - Input fields: `bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600`
     - The banner colors (yellow warning, red error) are fine in both modes.
  </action>
  <verify>
Run `pnpm build` (or `pnpm dev`) and confirm no TypeScript errors. Visually inspect that both popup and settings pages render with dark backgrounds by default.
  </verify>
  <done>
- Dark mode renders by default on both popup and settings pages
- Theme dropdown in settings switches between dark and light, persists via sync storage
- Clear All button is gone from popup
- Settings cog is visibly larger in popup header
- Three separate color pickers shown in settings (tags/zerowidth/watermark) instead of one
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire per-class colors into content script and add Unicode codes to all replacement labels</name>
  <files>
    utils/scanner.ts
    entrypoints/content.ts
  </files>
  <action>
1. In `utils/scanner.ts`, update the replacement label format for ALL character types to include the Unicode code point:
   - For watermark chars (line ~167): Change from `[${name}]` to `[${name} U+${hex}]` where hex is the codepoint in uppercase hex padded to 4 chars. Example: `[Narrow No-Break Space U+202F]`
   - For zerowidth chars (line ~172): Add a human-readable name lookup. Create a `const ZEROWIDTH_NAMES: ReadonlyMap<number, string>` map with common names:
     - `0x200B` -> 'Zero Width Space'
     - `0x200C` -> 'Zero Width Non-Joiner'
     - `0x200D` -> 'Zero Width Joiner'
     - `0x200E` -> 'Left-to-Right Mark'
     - `0x200F` -> 'Right-to-Left Mark'
     - `0xFEFF` -> 'BOM'
     - `0x2060` -> 'Word Joiner'
     - `0x2061` -> 'Function Application'
     - `0x2062` -> 'Invisible Times'
     - `0x2063` -> 'Invisible Separator'
     - `0x2064` -> 'Invisible Plus'
     - `0x00AD` -> 'Soft Hyphen'
     - `0x061C` -> 'Arabic Letter Mark'
     - `0x034F` -> 'Combining Grapheme Joiner'
     - `0x180E` -> 'Mongolian Vowel Separator'
   - For zerowidth: If name exists in map, use `[${name} U+${hex}]`. If no name, use `[U+${hex}]` as before.
   - For Tags block decoded text, keep the current format (shows the decoded ASCII message) — no code needed since the whole run is decoded.

2. In `entrypoints/content.ts`, update `performFullScan` and `startObserving` to read per-class colors instead of the single highlight color:
   - Import `tagsColorSetting`, `zerowColorSetting`, `watermarkColorSetting` from storage.
   - In `performFullScan`, read all three color settings:
     ```
     const tagsColor = await tagsColorSetting.getValue();
     const zerowColor = await zerowColorSetting.getValue();
     const watermarkColor = await watermarkColorSetting.getValue();
     ```
   - Create a `classColors` object: `{ tags: tagsColor, zerowidth: zerowColor, watermark: watermarkColor }`
   - Change the `color` parameter threading through `scanTextNode`, `highlightFindings`, and `startObserving` from `string | null` to the classColors object type `Record<string, string>`.
   - In `highlightFindings`, instead of `color ?? CLASS_COLORS[finding.type]`, use `classColors[finding.type] ?? CLASS_COLORS[finding.type]` — always use the per-class color from settings.
   - Remove the old logic that checks if userColor equals DEFAULT_HIGHLIGHT_COLOR to decide between custom vs per-class. The three per-class settings ARE the colors now.
   - Update the `highlightColorSetting.watch` block at the bottom: Replace it with watchers for all three per-class settings. Each watcher updates highlights of its type:
     ```
     tagsColorSetting.watch((newColor) => {
       document.querySelectorAll<HTMLElement>('[data-iu-highlight][data-iu-type="tags"]')
         .forEach(el => el.style.backgroundColor = newColor);
     });
     ```
     Same pattern for zerowColorSetting (type="zerowidth") and watermarkColorSetting (type="watermark").
   - Remove the import of `highlightColorSetting` from content.ts.
  </action>
  <verify>
Run `pnpm build` and confirm no TypeScript errors. Run `pnpm test` if tests exist. Verify that scanner.test output (if any) shows named labels with Unicode codes like `[Zero Width Space U+200B]` and `[Narrow No-Break Space U+202F]`.
  </verify>
  <done>
- Zero-width chars display as `[Zero Width Space U+200B]` (name + code) in scan highlights
- Watermark chars display as `[Narrow No-Break Space U+202F]` (name + code) in scan highlights
- Per-class colors from settings are used for highlights (not a single global color)
- Changing any per-class color in settings live-updates existing highlights of that type
  </done>
</task>

</tasks>

<verification>
1. `pnpm build` completes without errors
2. Load extension in Chrome dev mode
3. Open popup — should be dark themed, no "Clear All" button, settings cog is larger
4. Open settings — should be dark themed, has theme dropdown, has 3 color pickers
5. Switch theme to light in settings, both settings page and popup switch to light
6. Scan a page with invisible characters — highlights use per-class colors from settings
7. Zero-width chars show name + Unicode code in highlight labels
8. Change a color in settings — existing highlights update in real-time
</verification>

<success_criteria>
- Dark mode is default across popup and settings
- Theme is user-selectable and persists in sync storage
- Clear All button removed from popup
- Settings cog visibly larger
- Three per-class color pickers in settings replace the single color picker
- All invisible character highlights show Unicode code points
- Zero-width and watermark chars show human-readable names alongside codes
</success_criteria>

<output>
After completion, create `.planning/quick/1-add-dark-mode-fix-settings-ui-remove-bro/1-SUMMARY.md`
</output>
