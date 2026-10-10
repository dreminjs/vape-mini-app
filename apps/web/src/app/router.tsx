import { createBrowserRouter, type RouteObject } from 'react-router';

import { meQuery } from '../features/session/api';
import { prefetch } from '../shared/lib/query-client';
import { ProductGridSkeleton } from '../shared/ui/skeleton';

import { AppLayout } from './layout';
import { RouteError } from './route-error';

/** Routes are lazy. The /admin tree lives in its own chunks, so customers never load admin code. */
export const routes: RouteObject[] = [
  {
    path: '/',
    Component: AppLayout,
    ErrorBoundary: RouteError,
    HydrateFallback: () => (
      <div className="p-4">
        <ProductGridSkeleton />
      </div>
    ),
    loader: async () => {
      await prefetch(meQuery());
      return null;
    },
    children: [
      // The catalog opens right away; the 18+ confirmation is part of checkout.
      {
        ErrorBoundary: RouteError,
        children: [
          {
            index: true,
            lazy: () => import('../features/catalog/catalog-page'),
            ErrorBoundary: RouteError,
          },
          {
            path: 'product/:id',
            lazy: () => import('../features/product/product-page'),
            ErrorBoundary: RouteError,
          },
          {
            path: 'cart',
            lazy: () => import('../features/cart/cart-page'),
            ErrorBoundary: RouteError,
          },
          {
            path: 'roulette',
            lazy: () => import('../features/roulette/roulette-page'),
            ErrorBoundary: RouteError,
          },
          {
            path: 'orders',
            lazy: () => import('../features/orders/orders-page'),
            ErrorBoundary: RouteError,
          },
          {
            path: 'orders/:id',
            lazy: () => import('../features/orders/order-details-page'),
            ErrorBoundary: RouteError,
          },
          {
            path: 'profile',
            lazy: () => import('../features/session/profile-page'),
            ErrorBoundary: RouteError,
          },
        ],
      },
      {
        path: 'admin',
        lazy: () => import('../features/admin/admin-layout'),
        ErrorBoundary: RouteError,
        children: [
          {
            index: true,
            lazy: () => import('../features/admin/stock-page'),
            ErrorBoundary: RouteError,
          },
          {
            path: 'stock',
            lazy: () => import('../features/admin/stock-page'),
            ErrorBoundary: RouteError,
          },
          {
            path: 'products/new',
            lazy: () => import('../features/admin/product-form-page'),
            ErrorBoundary: RouteError,
          },
          {
            path: 'products/:id',
            lazy: () => import('../features/admin/product-form-page'),
            ErrorBoundary: RouteError,
          },
          {
            path: 'orders',
            lazy: () => import('../features/admin/orders-page'),
            ErrorBoundary: RouteError,
          },
          {
            path: 'finance',
            lazy: () => import('../features/admin/finance-page'),
            ErrorBoundary: RouteError,
          },
          {
            path: 'roulette',
            lazy: () => import('../features/admin/odds-page'),
            ErrorBoundary: RouteError,
          },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
