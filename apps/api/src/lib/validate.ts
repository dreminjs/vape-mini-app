import { zValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import type { z } from 'zod';

import { validationFailed } from '../errors.js';

/** zod validator that throws our AppError, so all errors share one JSON format. */
export const validate = <Target extends keyof ValidationTargets, Schema extends z.ZodType>(
  target: Target,
  schema: Schema,
) =>
  zValidator(target, schema, (result) => {
    if (!result.success) {
      throw validationFailed(
        result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }
  });
