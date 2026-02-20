import { useState, useRef } from 'preact/hooks';
import { encode, decode } from '@/utils/codec';
import { copyToClipboard } from '@/utils/clipboard';

export function App() {
  const [encodeInput, setEncodeInput] = useState('');
  const [encodeOutput, setEncodeOutput] = useState('');
  const [decodeInput, setDecodeInput] = useState('');
  const [decodeOutput, setDecodeOutput] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<'idle' | 'success' | 'fail'>('idle');
  const copyTimer = useRef<number>(0);

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

  return (
    <div class="flex flex-col gap-4 p-4 bg-gray-50 min-h-full text-sm">
      <div class="flex items-center justify-between">
        <h1 class="text-base font-semibold text-gray-800">InvisibleUnicode</h1>
        <button
          type="button"
          onClick={handleClear}
          class="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-200 transition-colors"
        >
          Clear All
        </button>
      </div>

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
