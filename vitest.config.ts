/**
 * Vitest configuration for the Stegano extension test suite.
 *
 * Uses the WxtVitest plugin for browser extension test compatibility.
 */

import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    passWithNoTests: true,
  },
});
