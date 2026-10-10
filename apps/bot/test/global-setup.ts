import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Applies migrations to the test database once before all integration tests. */
export default function setup(): void {
  const rootEnv = resolve(import.meta.dirname, '../../../.env');
  if (!process.env.TEST_DATABASE_URL && existsSync(rootEnv)) process.loadEnvFile(rootEnv);
  const url = process.env.TEST_DATABASE_URL;
  if (!url)
    throw new Error('TEST_DATABASE_URL is required for integration tests (run `pnpm db:up`)');

  execFileSync('pnpm', ['--filter', '@vapehard/db', 'exec', 'prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}
