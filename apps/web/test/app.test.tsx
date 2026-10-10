import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { routes } from '../src/app/router';
import { useCartStore } from '../src/features/cart/store';
import { queryClient } from '../src/shared/lib/query-client';

import { API, handlers, me } from './fixtures';

const server = setupServer(...handlers);
beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
  useCartStore.getState().clear();
});
afterAll(() => {
  server.close();
});

function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe('customer flow', () => {
  it('catalog → product → cart → checkout → success dialog', async () => {
    const user = userEvent.setup();
    let orderBody: unknown;
    let idempotencyKey: string | null = null;
    server.use(
      http.post(`${API}/orders`, async ({ request }) => {
        orderBody = await request.json();
        idempotencyKey = request.headers.get('idempotency-key');
        const { order } = await import('./fixtures');
        return HttpResponse.json(order, { status: 201 });
      }),
    );

    renderApp('/');
    await user.click(await screen.findByRole('link', { name: /Husky Premium 30ml/ }));

    // Out-of-stock variant is disabled; the available one can be picked.
    expect(await screen.findByLabelText(/Big Ball/)).toBeDisabled();
    await user.click(screen.getByLabelText(/Miami Snow/));
    await user.click(screen.getByRole('button', { name: 'Увеличить' }));
    expect(screen.getByText('Выбрано: 2 шт.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Добавить в корзину/ }));

    await user.click(await screen.findByRole('link', { name: /Корзина/ }));
    expect(await screen.findByText('Оформление заказа')).toBeInTheDocument();
    expect(await screen.findByText('Итого к оплате')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Оформить и написать менеджеру/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/VH-1001/)).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: /Написать @VapeHard_manager/ }),
    ).toBeInTheDocument();

    expect(orderBody).toEqual({ items: [{ variantId: 10, qty: 2 }], deliveryMethod: 'PICKUP' });
    expect(idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(useCartStore.getState().lines).toEqual([]);
  });

  it('shows the catalog without an 18+ screen; checkout needs the 18+ checkbox', async () => {
    const user = userEvent.setup();
    let confirmed = false;
    server.use(
      http.get(`${API}/me`, () => HttpResponse.json({ ...me, ageConfirmed: confirmed })),
      http.post(`${API}/me/confirm-age`, () => {
        confirmed = true;
        return HttpResponse.json({ ...me, ageConfirmed: true });
      }),
    );
    useCartStore.getState().add([
      {
        productId: 1,
        variantId: 10,
        productName: 'Husky',
        variantName: 'Miami Snow',
        unitPriceMinor: 2800,
        imageUrl: null,
        qty: 1,
        maxStock: 5,
      },
    ]);
    renderApp('/');
    expect(await screen.findByRole('link', { name: /Husky Premium 30ml/ })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /Корзина/ }));
    const checkout = await screen.findByRole('button', { name: /Оформить и написать менеджеру/ });
    expect(checkout).toBeDisabled();
    await user.click(screen.getByLabelText('Мне есть 18 лет'));
    await user.click(checkout);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(confirmed).toBe(true);
  });

  it('logs in to the admin panel with a password', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/me/admin-login`, async ({ request }) => {
        const { password } = (await request.json()) as { password: string };
        return password === 'secret-pass-1'
          ? HttpResponse.json({ ...me, isAdmin: true })
          : HttpResponse.json(
              { error: { code: 'FORBIDDEN', message: 'Неверный пароль' } },
              { status: 403 },
            );
      }),
    );
    renderApp('/profile');
    const input = await screen.findByLabelText('Пароль администратора');
    await user.type(input, 'wrong');
    await user.click(screen.getByRole('button', { name: 'Войти' }));
    expect(await screen.findByText('Неверный пароль')).toBeInTheDocument();

    await user.type(input, 'secret-pass-1');
    await user.click(screen.getByRole('button', { name: 'Войти' }));
    expect(
      await screen.findByRole('link', { name: 'Открыть панель управления' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Админка/ })).toBeInTheDocument();
  });

  it('hides the admin tab for customers', async () => {
    renderApp('/');
    await screen.findByRole('link', { name: /Husky Premium 30ml/ });
    expect(screen.queryByRole('link', { name: 'Админка' })).not.toBeInTheDocument();
  });
});

describe('empty and error states', () => {
  it('shows the empty cart with a link to the catalog', async () => {
    renderApp('/cart');
    expect(await screen.findByText('Корзина пуста')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Перейти в каталог' })).toHaveAttribute('href', '/');
  });

  it('shows "no results" with a reset button for a search without matches', async () => {
    renderApp('/?q=zzz');
    expect(await screen.findByText('Ничего не найдено')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сбросить поиск' })).toBeInTheDocument();
  });

  it('shows an inline error with retry when the API fails', async () => {
    server.use(
      http.get(`${API}/products`, () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL', message: 'Внутренняя ошибка сервера' } },
          { status: 500 },
        ),
      ),
    );
    renderApp('/');
    expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toHaveTextContent(
      'Внутренняя ошибка сервера',
    );
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });

  it('shows the out-of-stock banner when the server reduces quantities', async () => {
    server.use(
      http.post(`${API}/cart/validate`, () => {
        const v = {
          lines: [
            {
              variantId: 10,
              productId: 1,
              productName: 'Husky',
              variantName: 'Miami Snow',
              imageUrl: null,
              unitPriceMinor: 2800,
              availableStock: 1,
              available: true,
              requestedQty: 3,
              qty: 1,
              issue: 'NOT_ENOUGH_STOCK',
            },
          ],
          subtotalMinor: 2800,
          discountMinor: 0,
          deliveryCostMinor: 0,
          totalMinor: 2800,
          reward: null,
          rewardError: null,
        };
        return HttpResponse.json(v);
      }),
    );
    useCartStore.getState().add([
      {
        productId: 1,
        variantId: 10,
        productName: 'Husky',
        variantName: 'Miami Snow',
        unitPriceMinor: 2800,
        imageUrl: null,
        qty: 3,
        maxStock: 5,
      },
    ]);
    renderApp('/cart');
    expect(await screen.findByText(/Количество исправлено/)).toBeInTheDocument();
    await waitFor(() => {
      expect(useCartStore.getState().lines[0]?.qty).toBe(1);
    });
  });
});
