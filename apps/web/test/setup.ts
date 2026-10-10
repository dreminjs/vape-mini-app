import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom has no IntersectionObserver / matchMedia.
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
vi.stubGlobal('IntersectionObserver', NoopObserver);
vi.stubGlobal(
  'matchMedia',
  (query: string) =>
    ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList,
);

afterEach(() => {
  cleanup();
  localStorage.clear();
});
