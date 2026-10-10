import type { ErrorCode } from '@vapehard/shared';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export class AppError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, details);
export const validationFailed = (details: unknown) =>
  new AppError(400, 'VALIDATION_FAILED', 'Некорректные данные', details);
export const unauthorized = (message = 'Требуется авторизация через Telegram') =>
  new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Недостаточно прав') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Не найдено') => new AppError(404, 'NOT_FOUND', message);
export const conflict = (code: ErrorCode, message: string, details?: unknown) =>
  new AppError(409, code, message, details);
