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
    name: 'Stegano',
    description: 'AI Red Team tool — hide and detect invisible Unicode on any web page. Test prompt injection, find ASCII smuggling, reveal hidden text.',
    homepage_url: 'https://dawid.ai/stegano',
    action: {},
    permissions: ['storage', 'activeTab', 'scripting'],
    optional_host_permissions: ['<all_urls>'],
    commands: {
      _execute_action: {
        suggested_key: { default: 'Ctrl+Shift+U', mac: 'Command+Shift+U' },
      },
      'trigger-scan': {
        suggested_key: { default: 'Alt+Shift+S', mac: 'Command+Shift+S' },
        description: 'Scan page for invisible characters',
      },
      'quick-paste': {
        suggested_key: { default: 'Alt+Shift+V', mac: 'Command+Shift+V' },
        description: 'Paste primary invisible text snippet',
      },
    },
    options_ui: {
      page: 'settings.html',
      open_in_tab: true,
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self';",
    },
  },
});
