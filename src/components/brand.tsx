import { cn } from "@/lib/utils";
import logoAsset from "@/assets/activv-logo.asset.json";

export function ActivvLogo({
  className,
  size = "md",
  withWordmark = true,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  withWordmark?: boolean;
}) {
  const box =
    size === "sm" ? "size-8" : size === "lg" ? "size-14" : "size-11";
  const text =
    size === "sm" ? "text-lg" : size === "lg" ? "text-3xl" : "text-2xl";
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          box,
          "relative shrink-0 overflow-hidden rounded-xl bg-background",
        )}
      >
        {/* Zoom into logo art without growing the bounding box */}
        <img
          src={logoAsset.url}
          alt="Activv"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover scale-[1.7] select-none"
        />
      </span>
      {withWordmark && (
        <span
          className={cn(
            "font-display tracking-tight leading-none text-foreground",
            text,
          )}
        >
          Connect<span className="text-primary">.</span>
        </span>
      )}
    </span>
  );
}

export function ActivvWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display tracking-tight text-foreground", className)}>
      Activv<span className="text-primary">.</span>
    </span>
  );
}
