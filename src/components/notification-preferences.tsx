import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  DEFAULT_PREFERENCES,
  fetchPreferences,
  savePreferences,
  type NotificationPreferences,
} from "@/lib/notifications";
import { supabase } from "@/integrations/supabase/client";

type Toggle = Exclude<keyof NotificationPreferences, "user_id" | "notifications_enabled">;

const TYPE_TOGGLES: { key: Toggle; label: string }[] = [
  { key: "match_reminder", label: "Match reminder (1 hour before)" },
  { key: "someone_joined", label: "Someone joined your match" },
  { key: "someone_left", label: "Someone left your match" },
  { key: "match_cancelled", label: "Match cancelled" },
  { key: "points_earned", label: "Points earned" },
];

const CHANNEL_TOGGLES: { key: Toggle; label: string }[] = [
  { key: "in_app_enabled", label: "In-app notifications" },
  { key: "push_enabled", label: "Push notifications" },
];

export function NotificationPreferencesSection() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user || cancelled) return;
      try {
        const p = await fetchPreferences(data.user.id);
        if (!cancelled) setPrefs(p);
      } catch (err) {
        console.warn("[prefs] load failed", err);
        if (!cancelled) setPrefs({ user_id: data.user.id, ...DEFAULT_PREFERENCES });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function update(next: NotificationPreferences) {
    setPrefs(next);
    try {
      await savePreferences(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save preferences");
    }
  }

  if (loading || !prefs) {
    return (
      <div className="rounded-2xl border border-border bg-card/40 p-4 text-sm text-muted-foreground">
        Loading preferences…
      </div>
    );
  }

  const masterOff = !prefs.notifications_enabled;

  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Notifications</p>
          <p className="mt-1 text-sm font-medium">All Notifications</p>
        </div>
        <Switch
          checked={prefs.notifications_enabled}
          onCheckedChange={(v) => update({ ...prefs, notifications_enabled: v })}
          className={masterOff ? "data-[state=unchecked]:bg-destructive" : ""}
          aria-label="Master notifications toggle"
        />
      </div>

      {masterOff && (
        <p className="text-xs text-destructive font-medium">
          You will not receive any notifications
        </p>
      )}

      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground pt-1">Types</p>
        {TYPE_TOGGLES.map(({ key, label }) => (
          <Row
            key={key}
            label={label}
            disabled={masterOff}
            checked={Boolean(prefs[key])}
            onChange={(v) => update({ ...prefs, [key]: v })}
          />
        ))}
      </div>

      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground pt-1">Delivery</p>
        {CHANNEL_TOGGLES.map(({ key, label }) => (
          <Row
            key={key}
            label={label}
            disabled={masterOff}
            checked={Boolean(prefs[key])}
            onChange={(v) => update({ ...prefs, [key]: v })}
          />
        ))}
      </div>
    </div>
  );
}

function Row({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 py-2 ${
        disabled ? "opacity-40 pointer-events-none" : ""
      }`}
    >
      <span className="text-sm text-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}