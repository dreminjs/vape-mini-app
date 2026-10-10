import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

import { devInitDataPlugin } from './dev/init-data-plugin.ts';

const rootEnv = resolve(import.meta.dirname, '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
// Mock Telegram user for the browser. A normal customer by default; log in as admin with ADMIN_PASSWORD.
const devUserId = Number(process.env.DEV_TG_USER_ID ?? 700001);

export default defineConfig({
  plugins: [react(), tailwindcss(), devInitDataPlugin(process.env.BOT_TOKEN, devUserId)],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/media': { target: 'http://localhost:9000', rewrite: (p) => p.replace(/^\/media/, '') },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    reportCompressedSize: true,
  },
  test: {
    environment: 'jsdom',
    // A fake origin, so tests never reach a locally running API (all calls go to MSW).
    environmentOptions: { jsdom: { url: 'http://vapehard.test/' } },
    setupFiles: ['./test/setup.ts'],
    css: false,
  },
});
