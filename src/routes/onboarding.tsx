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

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Set up your profile · Activv" }] }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"details" | "sports" | "levels">("details");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [levels, setLevels] = useState<Record<string, SkillLevel>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  // Profile details
  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("Chicago, IL");
  const [age, setAge] = useState("18");
  const [gender, setGender] = useState<Gender | "">("");

  useEffect(() => {
    (async () => {
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

  const stepLabel = step === "details" ? "1" : step === "sports" ? "2" : "3";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-4 py-6 sm:px-6 flex items-center justify-between max-w-3xl w-full mx-auto">
        <ActivvLogo size="sm" />
        <span className="chip">Step {stepLabel} of 3</span>
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
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jordan Carter"
                  maxLength={80}
                />
              </Field>
              <Field label="City *">
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Chicago, IL"
                  maxLength={80}
                />
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

            <div className="sticky bottom-0 left-0 right-0 mt-10 py-4 bg-gradient-to-t from-background to-transparent">
              <Button size="lg" className="w-full font-semibold" onClick={goToSports}>
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

            <div className="sticky bottom-0 left-0 right-0 mt-10 py-4 bg-gradient-to-t from-background to-transparent flex gap-3">
              <Button variant="secondary" size="lg" onClick={() => setStep("details")}>Back</Button>
              <Button
                size="lg"
                className="flex-1 font-semibold"
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
