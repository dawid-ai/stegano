/**
 * ESLint 9 flat config for the Stegano extension.
 *
 * Enforces TypeScript recommended rules and bans all network APIs
 * (fetch, XMLHttpRequest, WebSocket, EventSource, sendBeacon) to
 * guarantee the extension never makes outbound requests.
 */

import tseslint from 'typescript-eslint';

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message:
            'Network calls are forbidden (PLAT-02). This extension processes everything locally.',
        },
        {
          name: 'XMLHttpRequest',
          message:
            'Network calls are forbidden (PLAT-02). This extension processes everything locally.',
        },
        {
          name: 'WebSocket',
          message:
            'Network calls are forbidden (PLAT-02). This extension processes everything locally.',
        },
        {
          name: 'EventSource',
          message:
            'Network calls are forbidden (PLAT-02). This extension processes everything locally.',
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'navigator',
          property: 'sendBeacon',
          message:
            'Network calls are forbidden (PLAT-02). This extension processes everything locally.',
        },
      ],
    },
  },
  {
    ignores: ['.output/**', '.wxt/**', 'node_modules/**'],
  },
);
