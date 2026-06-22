import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ActivvLogo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import {
  updateUser,
  SPORTS,
  LEVELS,
  type SkillLevel,
  type SportPick,
} from "@/lib/activv-store";
import { supabase } from "@/integrations/supabase/client";
import { fetchProfileBundle, replaceUserSports } from "@/lib/supabase-profile";
import { toast } from "sonner";
import { Check, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Pick your sports · Activv" }] }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"sports" | "levels">("sports");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [levels, setLevels] = useState<Record<string, SkillLevel>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate({ to: "/auth" });
        return;
      }
      setUserId(data.user.id);
      const { sports } = await fetchProfileBundle(data.user.id);
      if (sports.length) {
        setSelected(new Set(sports.map((s) => s.sport)));
        const m: Record<string, SkillLevel> = {};
        sports.forEach((s) => (m[s.sport] = s.level));
        setLevels(m);
      }
    })();
  }, [navigate]);

  const selectedList = Array.from(selected);
  const allLeveled = selectedList.length > 0 && selectedList.every((s) => levels[s]);

  function toggleSport(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function setLevel(sport: string, level: SkillLevel) {
    setLevels((p) => ({ ...p, [sport]: level }));
  }

  async function finish() {
    if (!userId || saving) return;
    setSaving(true);
    try {
      const sports: SportPick[] = selectedList.map((s) => ({ sport: s, level: levels[s] }));
      await replaceUserSports(userId, sports);
      updateUser({ sports });
      toast.success("You're all set");
      navigate({ to: "/home" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your sports");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-4 py-6 sm:px-6 flex items-center justify-between max-w-3xl w-full mx-auto">
        <ActivvLogo size="sm" />
        <span className="chip">Step {step === "sports" ? "1" : "2"} of 2</span>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6 max-w-3xl w-full mx-auto pb-20">
        {step === "sports" ? (
          <>
            <p className="text-[11px] uppercase tracking-[0.25em] text-primary">Step 01</p>
            <h1 className="mt-2 text-4xl sm:text-5xl font-display leading-tight">
              What do you <span className="text-gradient-brand">play?</span>
            </h1>
            <p className="mt-3 text-muted-foreground">Tap each sport you want to be matched for.</p>

            <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {SPORTS.map((s) => {
                const active = selected.has(s.name);
                return (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => toggleSport(s.name)}
                    aria-pressed={active}
                    className={`relative rounded-2xl border p-5 text-left transition cursor-pointer ${
                      active
                        ? "border-primary bg-primary/10 shadow-[0_0_0_1px_var(--primary)]"
                        : "border-border bg-card/40 hover:border-primary/50"
                    }`}
                  >
                    <div className="text-3xl">{s.emoji}</div>
                    <div className="mt-3 font-medium">{s.name}</div>
                    {active && (
                      <span className="absolute top-2.5 right-2.5 grid place-items-center size-6 rounded-full bg-primary text-primary-foreground">
                        <Check className="size-3.5" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="sticky bottom-0 left-0 right-0 mt-10 py-4 bg-gradient-to-t from-background to-transparent">
              <Button
                size="lg"
                className="w-full font-semibold"
                disabled={selected.size === 0}
                onClick={() => setStep("levels")}
              >
                Continue ({selected.size}) <ChevronRight className="size-4" />
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[11px] uppercase tracking-[0.25em] text-primary">Step 02</p>
            <h1 className="mt-2 text-4xl sm:text-5xl font-display leading-tight">
              How <span className="text-gradient-brand">good</span> are you?
            </h1>
            <p className="mt-3 text-muted-foreground">Be honest — better calls mean better matches.</p>

            <div className="mt-8 space-y-4">
              {selectedList.map((sport) => {
                const emoji = SPORTS.find((s) => s.name === sport)?.emoji ?? "🏅";
                return (
                  <div key={sport} className="surface-card rounded-2xl p-5">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{emoji}</span>
                      <span className="font-display text-xl">{sport}</span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {LEVELS.map((l) => {
                        const active = levels[sport] === l.value;
                        return (
                          <button
                            key={l.value}
                            type="button"
                            onClick={() => setLevel(sport, l.value)}
                            aria-pressed={active}
                            className={`flex flex-col h-full min-h-[88px] rounded-xl border p-3 text-left transition cursor-pointer ${
                              active
                                ? "border-primary bg-primary/10"
                                : "border-border bg-background/30 hover:border-primary/50"
                            }`}
                          >
                            <div className="text-sm font-semibold">{l.label}</div>
                            <div className="mt-1 text-[11px] leading-snug text-muted-foreground">
                              {l.desc}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="sticky bottom-0 left-0 right-0 mt-10 py-4 bg-gradient-to-t from-background to-transparent flex gap-3">
              <Button variant="secondary" size="lg" onClick={() => setStep("sports")}>Back</Button>
              <Button size="lg" className="flex-1 font-semibold" disabled={!allLeveled || saving} onClick={finish}>
                {saving ? "Saving…" : "Find me a match"}
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
