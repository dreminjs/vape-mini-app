import { createHmac } from 'node:crypto';

import type { Plugin } from 'vite';

/**
 * DEV ONLY. Signs a fake Telegram initData on the dev server (Node side),
 * so the browser mock gets data the API accepts. The bot token never reaches the client bundle.
 * The plugin only exists in `vite dev` (apply: 'serve').
 */
export function devInitDataPlugin(botToken: string | undefined, userId: number): Plugin {
  return {
    name: 'vapehard-dev-init-data',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__dev/init-data', (_req, res) => {
        if (!botToken) {
          res.statusCode = 500;
          res.end('BOT_TOKEN is not set in .env');
          return;
        }
        const params = new URLSearchParams({
          auth_date: String(Math.floor(Date.now() / 1000)),
          query_id: 'dev-query',
          user: JSON.stringify({
            id: userId,
            first_name: 'Dev',
            last_name: 'User',
            username: 'dev_user',
            language_code: 'ru',
          }),
          // The SDK schema requires this field (Ed25519 third-party signature). The API ignores its value.
          signature: 'dev-signature',
        });
        const dataCheckString = [...params.entries()]
          .sort(([a], [b]) => (a < b ? -1 : 1))
          .map(([k, v]) => `${k}=${v}`)
          .join('\n');
        const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
        params.set('hash', createHmac('sha256', secret).update(dataCheckString).digest('hex'));
        res.setHeader('content-type', 'text/plain');
        res.end(params.toString());
      });
    },
  };
}
