import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { wheelTargetAngle, type PrizePublicDto, type SpinResultDto } from '@vapehard/shared';
import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';

import { prefersReducedMotion } from '../../shared/lib/hooks';
import { prefetch } from '../../shared/lib/query-client';
import { haptic } from '../../shared/lib/telegram';
import { Button } from '../../shared/ui/button';
import { useCartStore } from '../cart/store';

import { rouletteKeys, rouletteStateQuery, useSpin } from './api';

export async function loader() {
  await prefetch(rouletteStateQuery());
  return null;
}

const SPIN_MS = 4000;

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
}

function useCountdown(targetIso: string | null, clockOffsetMs: number): number {
  const [now, setNow] = useState(() => Date.now() + clockOffsetMs);
  useEffect(() => {
    if (!targetIso) return;
    const id = setInterval(() => {
      setNow(Date.now() + clockOffsetMs);
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, [targetIso, clockOffsetMs]);
  return targetIso ? Math.max(0, Date.parse(targetIso) - now) : 0;
}

function Wheel({
  prizes,
  rotation,
  animate,
}: {
  prizes: PrizePublicDto[];
  rotation: number;
  animate: boolean;
}) {
  const seg = 360 / prizes.length;
  const gradient = prizes
    .map((p, i) => `${p.color} ${String(i * seg)}deg ${String((i + 1) * seg)}deg`)
    .join(', ');
  return (
    <div className="relative mx-auto my-4 size-64">
      <ChevronDown
        className="absolute -top-4 left-1/2 z-20 size-8 -translate-x-1/2 text-vape-glow drop-shadow"
        aria-hidden
      />
      <div
        className="relative size-full overflow-hidden rounded-full border-4 border-slate-700 shadow-2xl"
        style={{
          transform: `rotate(${String(rotation)}deg)`,
          transition: animate
            ? `transform ${String(SPIN_MS)}ms cubic-bezier(0.15, 0.85, 0.35, 1)`
            : 'none',
          background: `conic-gradient(from 0deg, ${gradient})`,
        }}
        aria-hidden
      >
        {prizes.map((p, i) => (
          <div
            key={p.key}
            className="absolute top-1/2 left-1/2 w-24 text-xs leading-none font-bold whitespace-nowrap text-white"
            style={{
              transformOrigin: '0 0',
              transform: `rotate(${String(i * seg + seg / 2 - 90)}deg) translate(34px, -6px)`,
              textShadow: '0 1px 2px rgb(0 0 0 / 0.6)',
            }}
          >
            {p.label}
          </div>
        ))}
      </div>
      <div className="absolute top-1/2 left-1/2 z-10 flex size-12 -translate-1/2 items-center justify-center rounded-full border-2 border-vape-glow bg-vape-card text-xs font-bold text-white shadow-lg">
        VH
      </div>
    </div>
  );
}

export function Component() {
  const { data: state } = useSuspenseQuery(rouletteStateQuery());
  const qc = useQueryClient();
  const spin = useSpin();
  const setRewardCode = useCartStore((st) => st.setRewardCode);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResultDto | null>(null);
  const leftMs = useCountdown(state.nextSpinAt, state.clockOffsetMs);
  const canSpin = leftMs <= 0 && !spinning && !spin.isPending;

  const finish = (res: SpinResultDto) => {
    setSpinning(false);
    setResult(res);
    setRewardCode(res.reward.code);
    haptic.success();
    void qc.invalidateQueries({ queryKey: rouletteKeys.state });
  };

  const onSpin = async () => {
    const res = await spin.mutateAsync();
    // The server picked the prize; the wheel only plays the animation.
    if (prefersReducedMotion()) {
      setRotation(wheelTargetAngle(rotation, res.prizeIndex, state.prizes.length));
      finish(res);
      return;
    }
    setSpinning(true);
    setResult(null);
    setRotation(wheelTargetAngle(rotation, res.prizeIndex, state.prizes.length));
    setTimeout(() => {
      finish(res);
    }, SPIN_MS);
  };

  return (
    <div className="space-y-4 py-2 text-center">
      <div>
        <h1 className="text-xl font-extrabold text-white">🔥 Бонусная рулетка</h1>
        <p className="mt-1 text-sm text-vape-muted">
          Крутите колесо каждые 24 часа и получайте скидки
        </p>
      </div>

      <Wheel prizes={state.prizes} rotation={rotation} animate={!prefersReducedMotion()} />

      {leftMs > 0 && !spinning ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3" aria-live="polite">
          <p className="mb-1 text-sm text-vape-muted">Следующий бесплатный прокрут через:</p>
          <span className="font-mono text-lg font-extrabold text-vape-glow">
            {formatCountdown(leftMs)}
          </span>
        </div>
      ) : (
        <Button
          block
          className="min-h-12 animate-pulse-glow text-base font-black"
          disabled={!canSpin}
          pending={spin.isPending || spinning}
          onClick={() => void onSpin()}
        >
          {spinning ? 'ВРАЩЕНИЕ...' : 'КРУТИТЬ РУЛЕТКУ'}
        </Button>
      )}

      {result && (
        <div
          role="status"
          className="space-y-2 rounded-2xl border border-vape-glow bg-vape-card p-4"
        >
          <p className="text-sm text-slate-300">🎉 Поздравляем! Ваш приз:</p>
          <p className="text-lg font-black text-vape-green">{result.prize.title}</p>
          <p className="text-sm text-slate-300">
            Промокод{' '}
            <span className="select-text font-mono text-vape-glow">{result.reward.code}</span>
          </p>
          <p className="text-xs text-vape-muted">
            Промокод уже автоматически применён в вашей корзине!
          </p>
        </div>
      )}

      {state.rewards.length > 0 && (
        <section className="space-y-2 text-left">
          <h2 className="text-sm font-bold text-slate-200">Ваши активные промокоды</h2>
          <ul className="space-y-2">
            {state.rewards.map((r) => (
              <li
                key={r.code}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-vape-card p-3"
              >
                <div>
                  <p className="text-sm text-white">{r.title}</p>
                  <p className="select-text font-mono text-xs text-vape-glow">{r.code}</p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setRewardCode(r.code);
                    haptic.light();
                  }}
                >
                  В корзину
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
