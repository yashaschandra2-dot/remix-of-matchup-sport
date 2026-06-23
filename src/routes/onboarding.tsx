import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ActivvLogo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateUser,
  SPORTS,
  LEVELS,
  GENDERS,
  type SkillLevel,
  type SportPick,
  type Gender,
} from "@/lib/activv-store";
import { supabase } from "@/integrations/supabase/client";
import { fetchProfileBundle, hasCompletedOnboarding, replaceUserSports } from "@/lib/supabase-profile";
import { toast } from "sonner";
import { Check, ChevronRight, Camera } from "lucide-react";
import { NumberStepper } from "@/components/number-stepper";
import { CityPicker } from "@/components/city-picker";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/theme";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Set up your profile · Activv" }] }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"details" | "sports" | "levels" | "theme">("details");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [levels, setLevels] = useState<Record<string, SkillLevel>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");

  // Profile details
  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("Chicago, IL");
  const [age, setAge] = useState("18");
  const [gender, setGender] = useState<Gender | "">("");

  useEffect(() => {
    (async () => {
      setTheme(getStoredTheme());
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate({ to: "/auth" });
        return;
      }
      setUserId(data.user.id);
      setEmail(data.user.email ?? "");
      const { profile, sports } = await fetchProfileBundle(data.user.id);
      if (hasCompletedOnboarding(profile, sports)) {
        navigate({ to: "/home" });
        return;
      }
      if (profile?.full_name) setFullName(profile.full_name);
      if (profile?.city) setCity(profile.city);
      if (profile?.age != null) setAge(String(profile.age));
      if (profile?.gender) setGender(profile.gender as Gender);
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

  function goToSports() {
    if (!fullName.trim()) {
      toast.error("Please enter your full name");
      return;
    }
    if (!city.trim()) {
      toast.error("Please enter your city");
      return;
    }
    if (age) {
      const n = Number(age);
      if (Number.isNaN(n) || n < 13 || n > 99) {
        toast.error("Enter a valid age (13–99)");
        return;
      }
    }
    setStep("sports");
  }

  async function finish() {
    if (!userId || saving) return;
    setSaving(true);
    try {
      const ageNum = age ? Number(age) : null;
      const { error: profErr } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          city: city.trim(),
          age: ageNum,
          gender: gender || null,
          theme,
          completed: true,
        })
        .eq("id", userId);
      if (profErr) throw profErr;

      const sports: SportPick[] = selectedList.map((s) => ({ sport: s, level: levels[s] }));
      await replaceUserSports(userId, sports);
      updateUser({
        sports,
        name: fullName.trim(),
        city: city.trim(),
        age: ageNum ?? undefined,
        gender: (gender as Gender) || undefined,
      });
      toast.success("You're all set");
      navigate({ to: "/home" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your sports");
    } finally {
      setSaving(false);
    }
  }

  const stepLabel =
    step === "details" ? "1" : step === "sports" ? "2" : step === "levels" ? "3" : "4";

  function pickTheme(t: Theme) {
    setTheme(t);
    applyTheme(t);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-4 py-6 sm:px-6 flex items-center justify-between max-w-3xl w-full mx-auto">
        <ActivvLogo size="sm" />
        <span className="chip">Step {stepLabel} of 4</span>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6 max-w-3xl w-full mx-auto pb-20">
        {step === "details" ? (
          <>
            <p className="text-[11px] uppercase tracking-[0.25em] text-primary">Step 01</p>
            <h1 className="mt-2 text-4xl sm:text-5xl font-display leading-tight">
              Tell us about <span className="text-gradient-brand">you</span>
            </h1>
            <p className="mt-3 text-muted-foreground">
              We use this to match you with players nearby.
            </p>

            <div className="mt-8 surface-card rounded-2xl p-5 flex items-center gap-4">
              <div className="size-14 rounded-full bg-muted grid place-items-center text-muted-foreground">
                <Camera className="size-6" />
              </div>
              <div className="text-sm">
                <div className="font-medium">Profile photo</div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  Add photo later from your profile page — totally optional.
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <Field label="Full name *">
                <Input
                  inputMode="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jordan Carter"
                  maxLength={80}
                />
              </Field>
              <Field label="City *">
                <CityPicker value={city} onChange={setCity} placeholder="Select your city" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Age">
                  <NumberStepper
                    value={age ? Number(age) : null}
                    onChange={(v) => setAge(String(v))}
                    min={13}
                    max={100}
                  />
                </Field>
                <Field label="Gender">
                  <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDERS.map((g) => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              {email && (
                <p className="text-[11px] text-muted-foreground">Signed in as {email}</p>
              )}
            </div>

            <div className="sticky bottom-0 left-0 right-0 mt-10 py-4 bg-gradient-to-t from-background to-transparent pointer-events-none">
              <Button size="lg" className="w-full font-semibold pointer-events-auto" onClick={goToSports}>
                Continue <ChevronRight className="size-4" />
              </Button>
            </div>
          </>
        ) : step === "sports" ? (
          <>
            <p className="text-[11px] uppercase tracking-[0.25em] text-primary">Step 02</p>
            <h1 className="mt-2 text-4xl sm:text-5xl font-display leading-tight">
              What do you <span className="text-gradient-brand">play?</span>
            </h1>
            <p className="mt-3 text-muted-foreground">Tap each sport you want to be matched for. Pick at least one.</p>

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

            <div className="sticky bottom-0 left-0 right-0 mt-10 py-4 bg-gradient-to-t from-background to-transparent pointer-events-none flex gap-3">
              <Button variant="secondary" size="lg" className="pointer-events-auto" onClick={() => setStep("details")}>Back</Button>
              <Button
                size="lg"
                className="flex-1 font-semibold pointer-events-auto"
                disabled={selected.size === 0}
                onClick={() => setStep("levels")}
              >
                Continue ({selected.size}) <ChevronRight className="size-4" />
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[11px] uppercase tracking-[0.25em] text-primary">Step 03</p>
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
                    <div
                      className="mt-4 grid gap-2"
                      style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
                    >
                      {LEVELS.map((l) => {
                        const active = levels[sport] === l.value;
                        return (
                          <button
                            key={l.value}
                            type="button"
                            onClick={() => setLevel(sport, l.value)}
                            aria-pressed={active}
                            className={`flex flex-col w-full h-full min-h-[88px] rounded-xl border p-3 text-left transition cursor-pointer ${
                              active
                                ? "border-primary bg-primary/10"
                                : "border-border bg-background/30 hover:border-primary/50"
                            }`}
                          >
                            <div className="text-sm font-semibold text-left">
                              {l.label}
                            </div>
                            <div className="mt-1 text-[11px] leading-snug text-muted-foreground text-left">
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

            <div className="sticky bottom-0 left-0 right-0 mt-10 py-4 bg-gradient-to-t from-background to-transparent pointer-events-none flex gap-3">
              <Button variant="secondary" size="lg" className="pointer-events-auto" onClick={() => setStep("sports")}>Back</Button>
              <Button
                size="lg"
                className="flex-1 font-semibold pointer-events-auto"
                disabled={!allLeveled}
                onClick={() => setStep("theme")}
              >
                Continue <ChevronRight className="size-4" />
              </Button>
            </div>
          </>
        )}
        {step === "theme" && (
          <>
            <p className="text-[11px] uppercase tracking-[0.25em] text-primary">Step 04</p>
            <h1 className="mt-2 text-4xl sm:text-5xl font-display leading-tight">
              Choose your <span className="text-gradient-brand">theme</span>
            </h1>
            <p className="mt-3 text-muted-foreground">
              You can always change this later in Profile settings.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4">
              <ThemePreviewCard
                variant="dark"
                label="Dark"
                subtitle="Easy on the eyes"
                selected={theme === "dark"}
                onSelect={() => pickTheme("dark")}
              />
              <ThemePreviewCard
                variant="light"
                label="Light"
                subtitle="Clean and minimal"
                selected={theme === "light"}
                onSelect={() => pickTheme("light")}
              />
            </div>

            <div className="sticky bottom-0 left-0 right-0 mt-10 py-4 bg-gradient-to-t from-background to-transparent pointer-events-none flex gap-3">
              <Button variant="secondary" size="lg" className="pointer-events-auto" onClick={() => setStep("levels")}>Back</Button>
              <Button size="lg" className="flex-1 font-semibold pointer-events-auto" disabled={saving} onClick={finish}>
                {saving ? "Saving…" : "Find me a match"}
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function ThemePreviewCard({
  variant,
  label,
  subtitle,
  selected,
  onSelect,
}: {
  variant: "dark" | "light";
  label: string;
  subtitle: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const isDark = variant === "dark";
  const bg = isDark ? "#0d0d0f" : "#ffffff";
  const card = isDark ? "#1a1a1d" : "#f5f5f5";
  const text = isDark ? "#f5f0e6" : "#111111";
  const accent = isDark ? "#d4b46a" : "#111111";
  const muted = isDark ? "#7a7568" : "#aaaaaa";
  const border = isDark ? "rgba(255,255,255,0.08)" : "#e8e8e8";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`relative rounded-2xl border-2 p-3 text-left transition cursor-pointer ${
        selected ? "border-primary shadow-[0_0_0_1px_var(--primary)]" : "border-border hover:border-primary/50"
      }`}
    >
      {selected && (
        <span className="absolute top-2.5 right-2.5 z-10 grid place-items-center size-6 rounded-full bg-primary text-primary-foreground">
          <Check className="size-3.5" strokeWidth={3} />
        </span>
      )}
      <div
        className="rounded-xl overflow-hidden aspect-[3/4] p-2.5 flex flex-col gap-1.5"
        style={{ background: bg, border: `1px solid ${border}` }}
      >
        <div className="flex items-center justify-between">
          <div className="h-2 w-10 rounded-full" style={{ background: accent }} />
          <div className="size-3 rounded-full" style={{ background: muted, opacity: 0.6 }} />
        </div>
        <div className="h-2 w-16 rounded-full" style={{ background: text, opacity: 0.85 }} />
        <div className="h-1.5 w-12 rounded-full" style={{ background: muted }} />
        <div className="mt-1.5 rounded-lg p-2 flex-1 flex flex-col gap-1.5" style={{ background: card, border: `1px solid ${border}` }}>
          <div className="h-1.5 w-3/4 rounded-full" style={{ background: text, opacity: 0.7 }} />
          <div className="h-1.5 w-1/2 rounded-full" style={{ background: muted }} />
          <div className="mt-auto h-4 rounded" style={{ background: accent }} />
        </div>
        <div className="rounded-lg p-1.5 flex items-center justify-around" style={{ background: card, border: `1px solid ${border}` }}>
          <div className="size-2 rounded-full" style={{ background: accent }} />
          <div className="size-2 rounded-full" style={{ background: muted, opacity: 0.6 }} />
          <div className="size-2 rounded-full" style={{ background: muted, opacity: 0.6 }} />
        </div>
      </div>
      <div className="mt-3 px-1">
        <div className="font-display text-lg leading-tight">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>
      </div>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
