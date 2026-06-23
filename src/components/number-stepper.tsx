import { Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

type Props = {
  value: number | null;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  placeholder?: string;
};

/** Premium [-] [number] [+] selector. Long-press to fast-scroll. */
export function NumberStepper({ value, onChange, min = 13, max = 100, placeholder = "—" }: Props) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valRef = useRef<number>(value ?? min);

  useEffect(() => {
    valRef.current = value ?? min;
  }, [value, min]);

  const clamp = useCallback((n: number) => Math.max(min, Math.min(max, n)), [min, max]);

  const step = useCallback(
    (dir: 1 | -1) => {
      const next = clamp((value ?? min) + dir);
      valRef.current = next;
      onChange(next);
    },
    [value, min, clamp, onChange],
  );

  const stopHold = useCallback(() => {
    if (delayRef.current) {
      clearTimeout(delayRef.current);
      delayRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startHold = useCallback(
    (dir: 1 | -1) => {
      step(dir);
      delayRef.current = setTimeout(() => {
        timerRef.current = setInterval(() => {
          const next = clamp(valRef.current + dir);
          if (next === valRef.current) {
            stopHold();
            return;
          }
          valRef.current = next;
          onChange(next);
        }, 70);
      }, 350);
    },
    [step, clamp, onChange, stopHold],
  );

  useEffect(() => () => stopHold(), [stopHold]);

  const disabledMinus = (value ?? min) <= min;
  const disabledPlus = (value ?? min) >= max;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/40 p-2 select-none">
      <button
        type="button"
        aria-label="Decrease"
        disabled={disabledMinus}
        onPointerDown={(e) => { e.preventDefault(); startHold(-1); }}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        className="grid place-items-center size-12 rounded-xl bg-background/60 border border-border text-foreground transition active:scale-95 hover:border-primary/60 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Minus className="size-5" />
      </button>
      <div className="flex-1 text-center font-display text-3xl tabular-nums tracking-tight">
        {value == null ? <span className="text-muted-foreground text-xl">{placeholder}</span> : value}
      </div>
      <button
        type="button"
        aria-label="Increase"
        disabled={disabledPlus}
        onPointerDown={(e) => { e.preventDefault(); startHold(1); }}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        className="grid place-items-center size-12 rounded-xl bg-primary text-primary-foreground transition active:scale-95 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Plus className="size-5" />
      </button>
    </div>
  );
}