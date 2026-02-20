import { defineConfig } from 'wxt';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  vite: () => ({
    plugins: [preact(), tailwindcss()],
  }),
  manifest: {
    name: 'InvisibleUnicode',
    description: 'Detect and reveal hidden Unicode text on any web page',
    permissions: ['storage', 'activeTab', 'scripting'],
    optional_host_permissions: ['<all_urls>'],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self';",
    },
  },
});
