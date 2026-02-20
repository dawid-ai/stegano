import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'wxt';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  vite: () => ({
    plugins: [preact(), tailwindcss()],
    resolve: {
      alias: {
        'webextension-polyfill': resolve(__dirname, 'utils/browser-shim.ts'),
      },
    },
  }),
  manifest: {
    name: 'InvisibleUnicode',
    description: 'Detect and reveal hidden Unicode text on any web page',
    action: {},
    permissions: ['storage', 'activeTab', 'scripting'],
    optional_host_permissions: ['<all_urls>'],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self';",
    },
  },
});
