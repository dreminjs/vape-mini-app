// Fails the build if the initial JS (entry + modulepreload chunks) is over the budget (gzip).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 250;
const dist = join(import.meta.dirname, '..', 'dist');
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const files = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]);

let total = 0;
for (const file of files) {
  const size = gzipSync(readFileSync(join(dist, file))).length;
  total += size;
  process.stdout.write(`${(size / 1024).toFixed(1).padStart(7)} KB  ${file}\n`);
}
const totalKb = total / 1024;
process.stdout.write(`Initial JS (gzip): ${totalKb.toFixed(1)} KB / budget ${BUDGET_KB} KB\n`);

// Secrets must never reach the client bundle.
for (const file of files) {
  // A Telegram bot token, or the HMAC key used to sign initData (only the server may sign).
  const code = readFileSync(join(dist, file), 'utf8');
  if (/\d{8,10}:[A-Za-z0-9_-]{35}/.test(code) || /[`'"]WebAppData[`'"]/.test(code)) {
    process.stderr.write(`Secret-like content found in ${file}\n`);
    process.exit(1);
  }
}
if (totalKb > BUDGET_KB) process.exit(1);
