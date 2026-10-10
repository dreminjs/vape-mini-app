import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import { isRouteErrorResponse, useNavigate, useRevalidator, useRouteError } from 'react-router';

import { ApiError, NotFoundError } from '../shared/lib/api';
import { Button } from '../shared/ui/button';
import { ErrorState } from '../shared/ui/states';

function messageFor(error: unknown): string {
  if (error instanceof NotFoundError || (isRouteErrorResponse(error) && error.status === 404)) {
    return 'Страница не найдена';
  }
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Откройте магазин из Telegram, чтобы войти';
    if (error.status === 404) return 'Не найдено';
    return error.message;
  }
  return 'Что-то пошло не так';
}

/** errorElement for every route: inline message with a retry button. */
export function RouteError() {
  const error = useRouteError();
  const { reset } = useQueryErrorResetBoundary();
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  return (
    <div className="space-y-3 p-4">
      <ErrorState
        message={messageFor(error)}
        onRetry={() => {
          reset();
          void revalidator.revalidate();
        }}
      />
      <Button
        variant="ghost"
        block
        onClick={() => {
          void navigate('/');
        }}
      >
        На главную
      </Button>
    </div>
  );
}
