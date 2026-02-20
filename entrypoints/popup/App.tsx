import { useState, useRef, useCallback } from 'preact/hooks';
import { browser } from 'wxt/browser';
import { encode, decode } from '@/utils/codec';
import { copyToClipboard } from '@/utils/clipboard';
import { sendMessage } from '@/utils/messaging';
import { buildScanReport } from '@/utils/export';

export function App() {
  const [encodeInput, setEncodeInput] = useState('');
  const [encodeOutput, setEncodeOutput] = useState('');
  const [decodeInput, setDecodeInput] = useState('');
  const [decodeOutput, setDecodeOutput] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<'idle' | 'success' | 'fail'>('idle');
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'empty' | 'fail'>('idle');
  const copyTimer = useRef<number>(0);
  const exportTimer = useRef<number>(0);

  async function handleExport() {
    clearTimeout(exportTimer.current);
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) { setExportStatus('fail'); return; }

      const response = await sendMessage('getFindings', undefined, tab.id);
      if (!response || response.findings.length === 0) {
        setExportStatus('empty');
        exportTimer.current = window.setTimeout(() => setExportStatus('idle'), 2000);
        return;
      }

      const report = buildScanReport(response);
      const ok = await copyToClipboard(JSON.stringify(report, null, 2));
      setExportStatus(ok ? 'success' : 'fail');
    } catch {
      setExportStatus('fail');
    }
    exportTimer.current = window.setTimeout(() => setExportStatus('idle'), 2000);
  }

  function handleEncode() {
    try {
      const result = encode(encodeInput);
      setEncodeOutput(result);
      setError('');
    } catch (e) {
      setEncodeOutput('');
      setError(e instanceof Error ? e.message : 'Encoding failed');
    }
  }

  function handleDecodeInput(value: string) {
    setDecodeInput(value);
    setDecodeOutput(decode(value));
  }

  async function handleCopy() {
    if (!encodeOutput) return;
    clearTimeout(copyTimer.current);
    const ok = await copyToClipboard(encodeOutput);
    setCopied(ok ? 'success' : 'fail');
    copyTimer.current = window.setTimeout(() => setCopied('idle'), 2000);
  }

  function handleClear() {
    setEncodeInput('');
    setEncodeOutput('');
    setDecodeInput('');
    setDecodeOutput('');
    setError('');
    setCopied('idle');
    clearTimeout(copyTimer.current);
  }

  const handleScanPage = useCallback(async () => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    // Inject content script if not already present
    try {
      await sendMessage('ping', undefined, tab.id);
    } catch {
      await browser.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['/content-scripts/content.js'],
      });
    }

    // Start scan — fire and close popup immediately
    sendMessage('startScan', undefined, tab.id)
      .then((result) => {
        // Update badge from popup context
        if (result.count > 0) {
          const text = result.count > 999 ? '999+' : result.count.toString();
          void browser.action.setBadgeText({ text, tabId: tab.id! });
          void browser.action.setBadgeBackgroundColor({ color: '#F44336', tabId: tab.id! });
        } else {
          void browser.action.setBadgeText({ text: '\u2713', tabId: tab.id! });
          void browser.action.setBadgeBackgroundColor({ color: '#4CAF50', tabId: tab.id! });
          setTimeout(() => {
            void browser.action.setBadgeText({ text: '', tabId: tab.id! });
          }, 1500);
        }
      })
      .catch(() => {});
    window.close();
  }, []);

  const handleOpenSettings = useCallback(() => {
    void browser.tabs.create({ url: browser.runtime.getURL('settings.html') });
    window.close();
  }, []);

  return (
    <div class="flex flex-col gap-4 p-4 bg-gray-50 min-h-full text-sm">
      <div class="flex items-center justify-between">
        <h1 class="text-base font-semibold text-gray-800">InvisibleUnicode</h1>
        <div class="flex items-center gap-1">
          <button
            type="button"
            onClick={handleExport}
            class={`text-xs px-2 py-1 rounded transition-colors ${
              exportStatus === 'success'
                ? 'text-green-700 bg-green-100'
                : exportStatus === 'empty'
                  ? 'text-amber-700 bg-amber-100'
                  : exportStatus === 'fail'
                    ? 'text-red-700 bg-red-100'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
            }`}
          >
            {exportStatus === 'success'
              ? 'Copied!'
              : exportStatus === 'empty'
                ? 'No scan results'
                : exportStatus === 'fail'
                  ? 'Export failed'
                  : 'Export JSON'}
          </button>
          <button
            type="button"
            onClick={handleClear}
            class="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-200 transition-colors"
          >
            Clear All
          </button>
          <button
            type="button"
            onClick={handleOpenSettings}
            title="Settings"
            class="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-200 transition-colors"
          >
            &#9881;
          </button>
        </div>
      </div>

      {/* Scan Page Action */}
      <section class="flex flex-col gap-1">
        <button
          type="button"
          onClick={handleScanPage}
          class="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 active:bg-indigo-800 transition-colors"
        >
          Scan Page for Hidden Characters
        </button>
        <p class="text-[10px] text-gray-400 text-center">
          Or press <kbd class="px-1 py-0.5 bg-gray-200 text-gray-600 rounded text-[10px]">Alt+Shift+S</kbd> anytime without opening popup
        </p>
      </section>

      <hr class="border-gray-200" />

      {/* Encode Section */}
      <section class="flex flex-col gap-2">
        <label class="text-xs font-medium text-gray-600 uppercase tracking-wide">
          Encode
        </label>
        <textarea
          value={encodeInput}
          onInput={(e) => {
            setEncodeInput((e.target as HTMLTextAreaElement).value);
            if (error) setError('');
          }}
          placeholder="Type or paste text to encode..."
          class="w-full h-24 px-3 py-2 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-sm"
        />
        <div class="flex items-center gap-2">
          <button
            type="button"
            onClick={handleEncode}
            disabled={!encodeInput}
            class="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Encode
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!encodeOutput}
            class={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
              copied === 'success'
                ? 'bg-green-100 text-green-700 border border-green-300'
                : copied === 'fail'
                  ? 'bg-red-100 text-red-700 border border-red-300'
                  : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {copied === 'success'
              ? 'Copied!'
              : copied === 'fail'
                ? 'Copy failed'
                : 'Copy'}
          </button>
        </div>
        {error && (
          <p class="text-xs text-red-600">{error}</p>
        )}
        {encodeOutput && (
          <div class="flex flex-col gap-1">
            <textarea
              value={encodeOutput}
              readOnly
              class="w-full h-16 px-3 py-2 border border-gray-200 rounded-md resize-none bg-gray-100 text-sm text-transparent select-all"
            />
            <p class="text-xs text-gray-500">
              {[...encodeOutput].length} invisible characters
            </p>
          </div>
        )}
      </section>

      {/* Decode Section */}
      <section class="flex flex-col gap-2">
        <label class="text-xs font-medium text-gray-600 uppercase tracking-wide">
          Decode
        </label>
        <textarea
          value={decodeInput}
          onInput={(e) =>
            handleDecodeInput((e.target as HTMLTextAreaElement).value)
          }
          placeholder="Paste invisible Unicode to decode..."
          class="w-full h-24 px-3 py-2 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-sm"
        />
        {decodeOutput && (
          <textarea
            value={decodeOutput}
            readOnly
            class="w-full h-20 px-3 py-2 border border-gray-200 rounded-md resize-none bg-gray-100 text-sm"
          />
        )}
      </section>
    </div>
  );
}
