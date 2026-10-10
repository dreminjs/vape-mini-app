import { useSuspenseInfiniteQuery, useSuspenseQuery } from '@tanstack/react-query';
import { PackageOpen, Search, SearchX } from 'lucide-react';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useDebouncedValue } from '../../shared/lib/hooks';
import { prefetch, prefetchInfinite } from '../../shared/lib/query-client';
import { Button } from '../../shared/ui/button';
import { ProductGridSkeleton } from '../../shared/ui/skeleton';
import { EmptyState } from '../../shared/ui/states';

import { categoriesQuery, productsInfiniteQuery } from './api';
import { ProductCard } from './product-card';
import { s } from './strings';

export async function loader({ request }: { request: Request }) {
  const params = new URL(request.url).searchParams;
  await Promise.all([
    prefetch(categoriesQuery()),
    prefetchInfinite(
      productsInfiniteQuery(params.get('category') ?? undefined, params.get('q') ?? undefined),
    ),
  ]);
  return null;
}

function CategoryChips({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (slug: string | undefined) => void;
}) {
  const { data: categories } = useSuspenseQuery(categoriesQuery());
  const chips = [{ slug: undefined, title: s.all }, ...categories];
  return (
    <nav
      aria-label={s.categories}
      className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1"
    >
      {chips.map((c) => {
        const active = c.slug === value;
        return (
          <button
            key={c.slug ?? 'all'}
            type="button"
            aria-pressed={active}
            onClick={() => {
              onChange(c.slug);
            }}
            className={`ui-chrome min-h-11 shrink-0 snap-start rounded-xl px-4 text-sm font-medium whitespace-nowrap transition ${
              active
                ? 'bg-vape-accent text-white shadow-md'
                : 'bg-vape-card text-slate-300 hover:bg-slate-800'
            }`}
          >
            {c.title}
          </button>
        );
      })}
    </nav>
  );
}

function ProductGrid({
  category,
  q,
  onReset,
}: {
  category: string | undefined;
  q: string | undefined;
  onReset: () => void;
}) {
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage } = useSuspenseInfiniteQuery(
    productsInfiniteQuery(category, q),
  );
  const sentinel = useRef<HTMLDivElement>(null);

  // Infinite scroll: load the next page when the sentinel becomes visible.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: '400px' },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const products = data.pages.flatMap((p) => p.items);
  if (products.length === 0) {
    return q ? (
      <EmptyState
        icon={SearchX}
        title={s.noResultsTitle}
        text={s.noResultsText}
        action={
          <Button variant="secondary" onClick={onReset}>
            {s.resetSearch}
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={PackageOpen}
        title={s.emptyCategoryTitle}
        text={s.emptyCategoryText}
        action={
          <Button variant="secondary" onClick={onReset}>
            {s.showAll}
          </Button>
        }
      />
    );
  }
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      <div ref={sentinel} aria-hidden className="h-4" />
      {isFetchingNextPage && <p className="text-center text-sm text-vape-muted">{s.loadingMore}</p>}
    </>
  );
}

export function Component() {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') ?? undefined;
  const urlQ = params.get('q') ?? '';
  const [input, setInput] = useState(urlQ);
  const debounced = useDebouncedValue(input.trim(), 300);

  // The search term lives in the URL: shareable and restored on back navigation.
  useEffect(() => {
    if (debounced === urlQ) return;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (debounced) next.set('q', debounced);
        else next.delete('q');
        return next;
      },
      { replace: true },
    );
  }, [debounced, urlQ, setParams]);

  const setCategory = (slug: string | undefined) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (slug) next.set('category', slug);
      else next.delete('category');
      return next;
    });
  };
  const reset = () => {
    setInput('');
    setParams({});
  };

  return (
    <div className="space-y-4">
      <h1 className="sr-only">Каталог</h1>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-vape-muted"
          aria-hidden
        />
        <input
          type="search"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
          }}
          placeholder={s.searchPlaceholder}
          aria-label={s.searchLabel}
          className="min-h-11 w-full rounded-xl border border-slate-800 bg-vape-card pr-3 pl-9 text-sm text-white placeholder:text-slate-500 focus:border-vape-accent focus:outline-none"
        />
      </div>
      <CategoryChips value={category} onChange={setCategory} />
      <Suspense fallback={<ProductGridSkeleton />}>
        <ProductGrid category={category} q={urlQ || undefined} onReset={reset} />
      </Suspense>
    </div>
  );
}
