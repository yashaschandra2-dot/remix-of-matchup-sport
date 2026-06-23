import { Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

type Props = {
  value: number | null;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
};

/** Premium [-] [number] [+] selector. Long-press to fast-scroll. */
export function NumberStepper({ value, onChange, min = 13, max = 100 }: Props) {
  const defaultValue = Math.max(min, Math.min(max, 18));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valRef = useRef<number>(value ?? defaultValue);

  useEffect(() => {
    valRef.current = value ?? defaultValue;
  }, [value, defaultValue]);

  const clamp = useCallback((n: number) => Math.max(min, Math.min(max, n)), [min, max]);

  const step = useCallback(
    (dir: 1 | -1) => {
      const next = clamp((value ?? defaultValue) + dir);
      valRef.current = next;
      onChange(next);
    },
    [value, defaultValue, clamp, onChange],
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

  const disabledMinus = (value ?? defaultValue) <= min;
  const disabledPlus = (value ?? defaultValue) >= max;

  return (
    <div className="flex h-9 w-full items-center rounded-md border border-input bg-transparent px-1 shadow-sm select-none">
      <button
        type="button"
        aria-label="Decrease"
        disabled={disabledMinus}
        onPointerDown={(e) => { e.preventDefault(); startHold(-1); }}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        className="grid place-items-center size-7 rounded-sm text-muted-foreground transition active:scale-95 hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Minus className="size-4" />
      </button>
      <div className="flex-1 text-center text-sm font-semibold tabular-nums text-foreground">
        {value ?? defaultValue}
      </div>
      <button
        type="button"
        aria-label="Increase"
        disabled={disabledPlus}
        onPointerDown={(e) => { e.preventDefault(); startHold(1); }}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        className="grid place-items-center size-7 rounded-sm text-muted-foreground transition active:scale-95 hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}