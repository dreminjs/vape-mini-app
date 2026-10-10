import type { PrismaClient, User } from '@vapehard/db';

import type { Logger } from './logger.js';

export interface PresignedPost {
  url: string;
  fields: Record<string, string>;
}

/** Object storage port. The S3/MinIO adapter lives in lib/storage.ts; tests use a fake. */
export interface Storage {
  presignPost(key: string, contentType: string, maxBytes: number): Promise<PresignedPost>;
  exists(key: string): Promise<boolean>;
  remove(key: string): Promise<void>;
  ping(): Promise<void>;
}

export interface AppConfig {
  botToken: string;
  adminTelegramIds: ReadonlySet<bigint>;
  adminPassword: string;
  adminSessionHours: number;
  managerUsername: string;
  initDataMaxAgeSeconds: number;
  rewardTtlDays: number;
  mediaBaseUrl: string;
}

/** Everything services need. Time and randomness are injected for deterministic tests. */
export interface Deps {
  db: PrismaClient;
  storage: Storage;
  config: AppConfig;
  log: Logger;
  clock: () => Date;
  randomInt: (max: number) => number;
}

export type AuthUser = User;

export interface AppEnv {
  Variables: {
    deps: Deps;
    user: AuthUser;
    requestId: string;
  };
}
