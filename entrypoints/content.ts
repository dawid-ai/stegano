/**
 * Content script for InvisibleUnicode extension.
 *
 * Performs on-demand DOM scanning for invisible Unicode characters,
 * replacing them inline with highlighted decoded text or [U+XXXX] labels.
 * MutationObserver catches dynamically added content while scan is active.
 * Toggle off restores the original DOM exactly.
 *
 * Injected programmatically by the background service worker on icon click.
 * Registered with matches: ['<all_urls>'] but is a no-op until it receives
 * a startScan message (WXT requires matches for content scripts).
 */

import { onMessage } from '@/utils/messaging';
import { findInvisibleChars, type ScanFinding } from '@/utils/scanner';
import { highlightColorSetting } from '@/utils/storage';

/** Tags to skip when walking the DOM */
const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEMPLATE',
  'TEXTAREA',
]);

/** Default highlight color (matches storage default) */
const DEFAULT_HIGHLIGHT_COLOR = '#ffeb3b';

/** Per-class highlight colors for visual distinction */
const CLASS_COLORS: Record<string, string> = {
  tags: '#FFEB3B',      // Yellow — Tags block encoded messages
  zerowidth: '#FF9800', // Orange — Zero-width invisible chars
  watermark: '#E91E63', // Pink/Magenta — AI watermark indicators
};

/** Module-level state */
let observer: MutationObserver | null = null;
let scanActive = false;
let totalFindings = 0;
let allFindings: ScanFinding[] = [];

/**
 * Create a TreeWalker that visits text nodes, skipping elements that
 * should not be scanned (script, style, etc.) and our own highlight spans.
 */
function createScanWalker(root: Node): TreeWalker {
  return document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Node): number {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (parent.hasAttribute('data-iu-highlight'))
        return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
}

/**
 * Highlight findings within a text node by splitting it and inserting
 * styled spans with the decoded/labeled replacement text.
 *
 * Processes findings in REVERSE order (highest offset first) to avoid
 * invalidating earlier offsets when splitting text nodes.
 */
function highlightFindings(
  textNode: Text,
  findings: ScanFinding[],
  color: string | null,
): void {
  // Sort by start position descending so we process from end to beginning
  const sorted = [...findings].sort((a, b) => b.start - a.start);

  for (const finding of sorted) {
    // Split at finding.start — textNode becomes [0..start), afterStart becomes [start..)
    const afterStart = textNode.splitText(finding.start);
    // Split afterStart at the finding length — afterStart becomes the match, remainder is the rest
    const remainder = afterStart.splitText(finding.end - finding.start);

    // Create the highlight span
    const span = document.createElement('span');
    span.setAttribute('data-iu-highlight', 'true');
    span.setAttribute('data-iu-original', finding.original);
    span.setAttribute('data-iu-type', finding.type);
    span.textContent = finding.replacement;
    // null = per-class colors; string = user custom color
    span.style.backgroundColor = color ?? CLASS_COLORS[finding.type] ?? DEFAULT_HIGHLIGHT_COLOR;
    span.style.borderRadius = '2px';
    span.style.padding = '0 2px';
    span.style.fontFamily = 'monospace';
    span.style.fontSize = '0.85em';
    span.style.color = '#000';

    // Replace the match text node with the span
    afterStart.parentNode?.replaceChild(span, afterStart);

    // For the next finding (earlier in text), we work with textNode
    // which is the [0..start) portion — still valid for earlier offsets
    void remainder; // remainder stays in DOM after the span
  }
}

/**
 * Remove all highlight spans and restore original text.
 */
function clearAllHighlights(): void {
  const highlights = document.querySelectorAll('[data-iu-highlight]');
  for (const span of highlights) {
    const original = span.getAttribute('data-iu-original') ?? '';
    const textNode = document.createTextNode(original);
    span.parentNode?.replaceChild(textNode, span);
    // Merge adjacent text nodes
    textNode.parentNode?.normalize();
  }
}

/**
 * Scan a single text node and apply highlights if findings exist.
 * Returns the findings array for accumulation in allFindings.
 */
function scanTextNode(textNode: Text, color: string | null): ScanFinding[] {
  const text = textNode.textContent;
  if (!text) return [];

  const findings = findInvisibleChars(text, 'standard');
  if (findings.length === 0) return [];

  highlightFindings(textNode, findings, color);
  return findings;
}

/**
 * Start observing DOM mutations to scan dynamically added content.
 */
function startObserving(color: string | null): void {
  if (observer) return;

  let pendingNodes: Node[] = [];
  let rafScheduled = false;

  function processPending(): void {
    rafScheduled = false;
    const nodes = pendingNodes;
    pendingNodes = [];

    for (const node of nodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const findings = scanTextNode(node as Text, color);
        totalFindings += findings.length;
        allFindings.push(...findings);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const walker = createScanWalker(node);
        let textNode: Node | null;
        while ((textNode = walker.nextNode())) {
          const findings = scanTextNode(textNode as Text, color);
          totalFindings += findings.length;
          allFindings.push(...findings);
        }
      }
    }
  }

  observer = new MutationObserver((mutations) => {
    if (!scanActive) return;

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        // Skip our own highlight spans to prevent infinite loop
        if (
          node instanceof HTMLElement &&
          node.hasAttribute('data-iu-highlight')
        )
          continue;
        if (
          node.parentElement?.closest('[data-iu-highlight]')
        )
          continue;

        pendingNodes.push(node);
      }
    }

    if (pendingNodes.length > 0 && !rafScheduled) {
      rafScheduled = true;
      requestAnimationFrame(processPending);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

/**
 * Stop observing DOM mutations.
 */
function stopObserving(): void {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

/**
 * Perform a full page scan: walk the DOM, find invisible chars, highlight them.
 */
async function performFullScan(): Promise<{ count: number }> {
  const userColor = await highlightColorSetting.getValue();
  // If user has custom color (not the default), use it for all classes; otherwise per-class
  const color = userColor.toLowerCase() === DEFAULT_HIGHLIGHT_COLOR ? null : userColor;
  scanActive = true;
  totalFindings = 0;
  allFindings = [];

  // Walk the entire DOM
  const walker = createScanWalker(document.body);
  // Collect text nodes first, then process — avoids issues with DOM mutation during walk
  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text);
  }

  for (const textNode of textNodes) {
    const findings = scanTextNode(textNode, color);
    totalFindings += findings.length;
    allFindings.push(...findings);
  }

  // Start observing for dynamic content
  startObserving(color);

  return { count: totalFindings };
}

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    // Health check — verify content script is injected and responsive
    onMessage('ping', () => 'pong' as const);

    // Trigger a full DOM scan
    onMessage('startScan', async () => {
      return performFullScan();
    });

    // Clear all highlights and restore original DOM
    onMessage('clearScan', () => {
      clearAllHighlights();
      stopObserving();
      scanActive = false;
      totalFindings = 0;
      allFindings = [];
    });

    // Reactively update highlight color when setting changes (SETT-01)
    highlightColorSetting.watch((newColor) => {
      const isDefault = newColor.toLowerCase() === DEFAULT_HIGHLIGHT_COLOR;
      const highlights =
        document.querySelectorAll<HTMLElement>('[data-iu-highlight]');
      for (const el of highlights) {
        if (isDefault) {
          // Restore per-class colors
          const type = el.getAttribute('data-iu-type') ?? 'zerowidth';
          el.style.backgroundColor = CLASS_COLORS[type] ?? DEFAULT_HIGHLIGHT_COLOR;
        } else {
          // Custom color overrides all classes
          el.style.backgroundColor = newColor;
        }
      }
    });
  },
});
