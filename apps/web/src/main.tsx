import './index.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { Toaster } from 'sonner';

import { router } from './app/router';
import { queryClient } from './shared/lib/query-client';
import { initTelegram } from './shared/lib/telegram';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

// Telegram must be ready before the first API call (it provides initData).
await initTelegram();

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster theme="dark" position="top-center" richColors closeButton />
    </QueryClientProvider>
  </StrictMode>,
);
