import { pino, type Logger } from 'pino';

export type { Logger };

export function createLogger(level: string, pretty: boolean): Logger {
  return pino({
    level,
    // Never log secrets or raw Telegram initData.
    redact: {
      paths: ['req.headers.authorization', 'authorization', '*.initData', '*.token', '*.secret'],
      censor: '[redacted]',
    },
    ...(pretty ? { transport: { target: 'pino-pretty' } } : {}),
  });
}
