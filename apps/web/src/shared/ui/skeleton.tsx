export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-800/80 ${className}`} aria-hidden />;
}

export function ProductCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-vape-card p-2.5">
      <Skeleton className="aspect-square w-full" />
      <Skeleton className="mt-2 h-4 w-4/5" />
      <Skeleton className="mt-1 h-3 w-1/3" />
      <Skeleton className="mt-3 h-5 w-1/2" />
    </div>
  );
}

export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3" aria-busy="true" aria-label="Загрузка">
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Загрузка">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-2xl" />
      ))}
    </div>
  );
}

export function ProductPageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Загрузка">
      <Skeleton className="aspect-square w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}
