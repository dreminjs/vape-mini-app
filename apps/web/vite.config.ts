import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

import { devInitDataPlugin } from './dev/init-data-plugin.ts';

const rootEnv = resolve(import.meta.dirname, '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
const firstAdminId = Number(process.env.ADMIN_TELEGRAM_IDS?.split(',')[0] ?? 1);

export default defineConfig({
  plugins: [react(), tailwindcss(), devInitDataPlugin(process.env.BOT_TOKEN, firstAdminId)],
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
    setupFiles: ['./test/setup.ts'],
    css: false,
  },
});
