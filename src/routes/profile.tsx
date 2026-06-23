import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchProfileBundle,
  replaceUserSports,
  resolveAvatarUrl,
  signOutEverywhere,
  uploadAvatar,
  type ProfileRow,
  type UserSportRow,
} from "@/lib/supabase-profile";
import { GENDERS, LEVELS, SPORTS, type Gender, type SkillLevel } from "@/lib/activv-store";
import { toast } from "sonner";
import {
  Camera,
  UserCircle2,
  Info,
  Plus,
  X,
  Sun,
  Moon,
} from "lucide-react";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/theme";
import { NumberStepper } from "@/components/number-stepper";
import { CityPicker } from "@/components/city-picker";
import { NotificationPreferencesSection } from "@/components/notification-preferences";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile · Activv" }] }),
  component: ProfilePage,
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center px-6">
      <div className="surface-luxe rounded-3xl p-8 max-w-md text-center">
        <h1 className="text-2xl font-display">Couldn't load your profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Link to="/home" className="mt-4 inline-block text-primary underline">Back to dashboard</Link>
      </div>
    </div>
  ),
});

const TIERS = [
  { name: "Rookie", min: 0 },
  { name: "Contender", min: 500 },
  { name: "Elite", min: 1500 },
  { name: "Legend", min: 3000 },
];

function tierProgress(points: number) {
  const safe = Math.max(0, points);
  let currentIdx = 0;
  for (let i = 0; i < TIERS.length; i++) if (safe >= TIERS[i].min) currentIdx = i;
  const current = TIERS[currentIdx];
  const next = TIERS[currentIdx + 1];
  if (!next) return { current, next: null, pct: 100 };
  const pct = Math.min(100, Math.round(((safe - current.min) / (next.min - current.min)) * 100));
  return { current, next, pct };
}

function ProfilePage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [sports, setSports] = useState<UserSportRow[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [points, setPoints] = useState<number>(0);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [pwOpen, setPwOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  // editable form
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [age, setAge] = useState("18");
  const [gender, setGender] = useState<Gender | "">("");
  const [editSports, setEditSports] = useState<UserSportRow[]>([]);
  const [addingSport, setAddingSport] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate({ to: "/auth" });
        return;
      }
      if (!mounted) return;
      setAuthUser({ id: user.id, email: user.email ?? "" });
      try {
        const bundle = await fetchProfileBundle(user.id);
        if (!mounted) return;
        setProfile(bundle.profile);
        setSports(bundle.sports);
        setAvatarUrl(await resolveAvatarUrl(bundle.profile?.avatar_url));
        // Sync theme from DB so it stays in sync across devices
        const dbTheme = (bundle.profile as { theme?: string } | null)?.theme;
        if (dbTheme === "light" || dbTheme === "dark") {
          applyTheme(dbTheme);
        }
        const { data: pr } = await supabase
          .from("profiles")
          .select("points")
          .eq("id", user.id)
          .maybeSingle();
        if (mounted) setPoints(pr?.points ?? 0);
        const p = bundle.profile;
        setName(p?.full_name ?? "");
        setCity(p?.city ?? "");
        setBio(p?.bio ?? "");
        setAge(p?.age != null ? String(p.age) : "18");
        setGender((p?.gender as Gender | undefined) ?? "");
        setEditSports(bundle.sports);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not load profile");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [navigate]);

  const tier = useMemo(() => tierProgress(points), [points]);
  const pointsPositive = points >= 0;

  if (loading || !authUser) {
    return (
      <AppShell hideHeader>
        <div className="grid place-items-center py-24 text-muted-foreground text-sm">Loading your profile…</div>
      </AppShell>
    );
  }

  async function reload() {
    if (!authUser) return;
    const bundle = await fetchProfileBundle(authUser.id);
    setProfile(bundle.profile);
    setSports(bundle.sports);
    setAvatarUrl(await resolveAvatarUrl(bundle.profile?.avatar_url));
  }

  async function save() {
    if (!authUser || saving) return;
    setSaving(true);
    try {
      const ageNum = age ? Number(age) : null;
      const payload = {
        id: authUser.id,
        email: authUser.email ?? null,
        full_name: name.trim() || null,
        city: city.trim() || null,
        bio: bio.trim() || null,
        age: ageNum && !Number.isNaN(ageNum) ? ageNum : null,
        gender: gender || null,
        updated_at: new Date().toISOString(),
      };
      const { data: updated, error } = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "id" })
        .select()
        .maybeSingle();
      if (error) {
        console.error("[profile.save] upsert failed", error);
        throw error;
      }
      if (!updated) {
        const msg = "Profile save returned no row — check RLS policies.";
        console.error("[profile.save]", msg);
        throw new Error(msg);
      }
      try {
        await replaceUserSports(authUser.id, editSports);
      } catch (sportsErr) {
        console.error("[profile.save] sports replace failed", sportsErr);
        throw sportsErr;
      }
      // Apply server-confirmed values immediately, then refetch as backup.
      setProfile(updated as ProfileRow);
      setSports(editSports);
      await reload();
      setEditOpen(false);
      toast.success("Profile updated");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save your profile";
      console.error("[profile.save] error", err);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function onAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !authUser) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    try {
      await uploadAvatar(authUser.id, file);
      await reload();
      toast.success("Photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const fullName = profile?.full_name?.trim() || "";
  const initials = (fullName || authUser.email)
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : "";
  const topLevel = sports[0]?.level;
  const metaLine = [
    profile?.age != null ? `${profile.age} yrs` : null,
    profile?.gender || null,
    topLevel || null,
  ].filter(Boolean).join(" · ");

  return (
    <AppShell hideHeader>
      {/* HEADER CARD */}
      <section className="surface-luxe rounded-3xl p-6 sm:p-8 mb-5 text-center">
        <div className="relative inline-block">
          <div className="rounded-full p-[3px] bg-gradient-to-br from-primary via-primary/70 to-primary/30">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName || "Profile photo"}
                className="size-28 rounded-full object-cover bg-background"
              />
            ) : (
              <div className="size-28 rounded-full bg-gradient-to-br from-primary/80 to-accent grid place-items-center text-3xl font-display text-primary-foreground">
                {initials || <UserCircle2 className="size-10" />}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="absolute bottom-0 right-0 size-9 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-lg ring-2 ring-background hover:scale-105 transition"
            aria-label="Change profile photo"
          >
            <Camera className="size-4" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={onAvatarFile} className="hidden" />
        </div>

        <h1 className="mt-4 text-3xl font-display">
          {fullName || <span className="text-muted-foreground">Add your name</span>}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {profile?.city || "Add your city"}{memberSince && ` · Joined ${memberSince}`}
        </p>
        {metaLine && (
          <p className="mt-2 text-sm text-foreground/80">{metaLine}</p>
        )}
        {profile?.bio && (
          <p className="mt-4 text-sm text-muted-foreground max-w-md mx-auto">{profile.bio}</p>
        )}
      </section>

      {/* ACTIVV POINTS CARD */}
      <section className="surface-luxe rounded-3xl p-6 mb-5 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Activv Points</p>
          <PointsInfoPopover />
        </div>
        <div
          className={`mt-2 text-6xl font-display ${
            pointsPositive ? "text-primary" : "text-destructive"
          }`}
        >
          {points}
        </div>
        <div className="mt-5">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
            <span>{tier.current.name}</span>
            <span>{tier.next ? tier.next.name : "Max tier"}</span>
          </div>
          <div className="h-1.5 rounded-full bg-border overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary/70 to-primary transition-all"
              style={{ width: `${tier.pct}%` }}
            />
          </div>
          {tier.next && (
            <p className="mt-2 text-xs text-muted-foreground">
              {Math.max(0, tier.next.min - Math.max(0, points))} pts to {tier.next.name}
            </p>
          )}
        </div>
      </section>

      {/* SPORTS GRID */}
      <section className="mb-5">
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground text-center mb-3">Sports</p>
        {sports.length === 0 ? (
          <div className="surface-card rounded-2xl p-5 text-center">
            <p className="text-sm text-muted-foreground mb-3">You haven't picked any sports yet.</p>
            <Link to="/onboarding"><Button size="sm">Pick sports</Button></Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {sports.map((s) => {
              const emoji = SPORTS.find((sp) => sp.name === s.sport)?.emoji ?? "🏅";
              return (
                <div
                  key={s.sport}
                  className="surface-card rounded-2xl px-4 py-3 flex items-center gap-3"
                >
                  <span className="text-2xl shrink-0">{emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-base truncate">{s.sport}</div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-primary">
                      {s.level}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ACCOUNT ACTIONS */}
      <section className="max-w-md mx-auto w-full mt-6 space-y-3 px-1">
        <Button className="w-full h-12" onClick={() => setEditOpen(true)}>
          Edit Profile
        </Button>
        <Button variant="outline" className="w-full h-12" onClick={() => setPwOpen(true)}>
          Change Password
        </Button>
        <Button variant="outline" className="w-full h-12" onClick={() => setEmailOpen(true)}>
          Change Email
        </Button>

        {/* NOTIFICATIONS */}
        <NotificationPreferencesSection />

        {/* THEME TOGGLE */}
        <ThemeToggle />

        <Button
          variant="outline"
          className="w-full h-12 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={async () => {
            await signOutEverywhere();
            navigate({ to: "/" });
          }}
        >
          Sign Out
        </Button>
      </section>

      {/* EDIT PROFILE DIALOG */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>Update your personal details.</DialogDescription>
          </DialogHeader>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Full name"><Input inputMode="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></Field>
            <Field label="City"><CityPicker value={city} onChange={setCity} placeholder="Select your city" /></Field>
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
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Bio">
                <Textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={240} placeholder="Weekend warrior. Tennis & pickleball." />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Sports</Label>
              <div className="mt-2 space-y-2">
                {editSports.length === 0 && (
                  <p className="text-xs text-muted-foreground">No sports yet. Add one below.</p>
                )}
                {editSports.map((s) => {
                  const emoji = SPORTS.find((sp) => sp.name === s.sport)?.emoji ?? "🏅";
                  return (
                    <div key={s.sport} className="flex items-center gap-2 rounded-xl border border-border bg-card/40 px-3 py-2">
                      <span className="text-xl">{emoji}</span>
                      <span className="flex-1 text-sm font-medium truncate">{s.sport}</span>
                      <Select
                        value={s.level}
                        onValueChange={(v) =>
                          setEditSports((prev) =>
                            prev.map((p) => (p.sport === s.sport ? { ...p, level: v as SkillLevel } : p)),
                          )
                        }
                      >
                        <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {LEVELS.map((l) => (
                            <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <button
                        type="button"
                        onClick={() => setEditSports((prev) => prev.filter((p) => p.sport !== s.sport))}
                        className="grid place-items-center size-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        aria-label={`Remove ${s.sport}`}
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex gap-2">
                <Select value={addingSport} onValueChange={setAddingSport}>
                  <SelectTrigger className="h-10 flex-1"><SelectValue placeholder="Add a sport…" /></SelectTrigger>
                  <SelectContent>
                    {SPORTS.filter((sp) => !editSports.some((e) => e.sport === sp.name)).map((sp) => (
                      <SelectItem key={sp.name} value={sp.name}>{sp.emoji} {sp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!addingSport}
                  onClick={() => {
                    if (!addingSport) return;
                    setEditSports((prev) => [...prev, { sport: addingSport, level: "Intermediate" }]);
                    setAddingSport("");
                  }}
                >
                  <Plus className="size-4" /> Add
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} email={authUser.email} />
      <ChangeEmailDialog open={emailOpen} onOpenChange={setEmailOpen} currentEmail={authUser.email} />
    </AppShell>
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

function ChangePasswordDialog({
  open,
  onOpenChange,
  email,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  email: string;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setCurrent(""); setNext(""); setConfirm("");
  }

  async function submit() {
    if (busy) return;
    if (next.length < 8) return toast.error("New password must be at least 8 characters");
    if (next !== confirm) return toast.error("Passwords don't match");
    setBusy(true);
    try {
      const { error: signErr } = await supabase.auth.signInWithPassword({ email, password: current });
      if (signErr) throw new Error("Current password is incorrect");
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      toast.success("Password updated");
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>Enter your current password and choose a new one.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Current password">
            <Input inputMode="text" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          </Field>
          <Field label="New password">
            <Input inputMode="text" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          </Field>
          <Field label="Confirm new password">
            <Input inputMode="text" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !current || !next || !confirm}>
            {busy ? "Updating…" : "Update password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChangeEmailDialog({
  open,
  onOpenChange,
  currentEmail,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentEmail: string;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return toast.error("Enter a valid email");
    if (trimmed === currentEmail.toLowerCase()) return toast.error("That's already your email");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: trimmed });
      if (error) throw error;
      toast.success("Verification sent — check your new inbox to confirm.");
      setEmail("");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update email");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setEmail(""); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change email</DialogTitle>
          <DialogDescription>
            We'll send a verification link to the new address. Your email changes once you confirm.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Current email">
            <Input inputMode="text" value={currentEmail} disabled />
          </Field>
          <Field label="New email">
            <Input inputMode="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !email}>
            {busy ? "Sending…" : "Send verification"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PointsInfoPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="How Activv Points work"
          className="grid place-items-center size-5 rounded-full text-muted-foreground hover:text-primary active:text-primary transition"
        >
          <Info className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        sideOffset={8}
        className="w-[min(92vw,340px)] bg-card border border-primary/30 shadow-2xl rounded-2xl p-5 text-left"
      >
        <div className="space-y-4 text-sm">
          <p className="text-xs text-muted-foreground italic leading-relaxed">
            Note: Activv Points are reward points based on your activity — they do not indicate your sports skill level.
          </p>
          <section>
            <p className="text-[10px] uppercase tracking-[0.25em] text-primary mb-2">Tiers</p>
            <ul className="space-y-1 text-foreground/90">
              <li><span className="text-primary font-medium">Rookie</span> · 0 – 499 points</li>
              <li><span className="text-primary font-medium">Contender</span> · 500 – 1,499 points</li>
              <li><span className="text-primary font-medium">Elite</span> · 1,500 – 2,999 points</li>
              <li><span className="text-primary font-medium">Legend</span> · 3,000+ points</li>
            </ul>
          </section>
          <section>
            <p className="text-[10px] uppercase tracking-[0.25em] text-primary mb-2">Earn Points</p>
            <ul className="space-y-1 text-foreground/90">
              <li>+25 when a match you joined starts</li>
            </ul>
          </section>
          <section>
            <p className="text-[10px] uppercase tracking-[0.25em] text-primary mb-2">Lose Points</p>
            <ul className="space-y-1 text-foreground/90">
              <li>−5 leaving 30–45 mins before match</li>
              <li>−10 leaving 10–30 mins before match</li>
              <li>−15 leaving 0–10 mins before match</li>
            </ul>
          </section>
          <section>
            <p className="text-[10px] uppercase tracking-[0.25em] text-primary mb-2">Deleting a Match</p>
            <ul className="space-y-1 text-foreground/90">
              <li>0 lost if no players joined</li>
              <li>−5 deleted 30–45 mins before match</li>
              <li>−10 deleted 10–30 mins before match</li>
              <li>−15 deleted 0–10 mins before match</li>
            </ul>
          </section>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);
  function setT(t: Theme) {
    setTheme(t);
    applyTheme(t);
    // Persist to DB so theme follows the user across devices
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      supabase.from("profiles").update({ theme: t }).eq("id", uid).then(() => {});
    });
  }
  return (
    <div className="rounded-xl border border-border bg-card/40 p-1 flex items-center">
      <p className="px-3 text-xs uppercase tracking-[0.2em] text-muted-foreground flex-1">App Theme</p>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setT("light")}
          aria-label="Light theme"
          className={`size-9 grid place-items-center rounded-lg transition ${
            theme === "light" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sun className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setT("dark")}
          aria-label="Dark theme"
          className={`size-9 grid place-items-center rounded-lg transition ${
            theme === "dark" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Moon className="size-4" />
        </button>
      </div>
    </div>
  );
}
