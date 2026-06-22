import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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
import { GENDERS, type Gender } from "@/lib/activv-store";
import { supabase } from "@/integrations/supabase/client";
import { hydrateLocalFromSupabase } from "@/lib/supabase-profile";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in · Activv" }] }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("Chicago, IL");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [password, setPassword] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!name.trim() || !email.trim() || !password) {
          toast.error("Please fill out all fields");
          return;
        }
        const ageNum = Number(age);
        if (!age || Number.isNaN(ageNum) || ageNum < 13 || ageNum > 99) {
          toast.error("Enter a valid age (13–99)");
          return;
        }
        if (!gender) {
          toast.error("Select your gender");
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/home`,
            data: {
              full_name: name.trim(),
              city: city.trim() || "Chicago, IL",
              age: String(ageNum),
              gender,
            },
          },
        });
        if (error) throw error;
        if (!data.session || !data.user) {
          toast.success("Check your inbox to confirm your email.");
          return;
        }
        await hydrateLocalFromSupabase(data.user.id, data.user.email ?? email.trim());
        toast.success(`Welcome, ${name.trim().split(" ")[0]}`);
        navigate({ to: "/onboarding" });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        if (!data.user) throw new Error("Sign-in failed");
        const { sports } = await hydrateLocalFromSupabase(data.user.id, data.user.email ?? email.trim());
        toast.success("Welcome back");
        navigate({ to: sports.length > 0 ? "/home" : "/onboarding" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-4 py-6 sm:px-6 max-w-6xl w-full mx-auto">
        <Link to="/"><ActivvLogo /></Link>
      </header>

      <main className="flex-1 grid place-items-center px-4 py-6 sm:px-6">
        <div className="surface-luxe w-full max-w-md rounded-3xl p-8 sm:p-10">
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-[0.25em] text-primary mb-3">Members Club</p>
            <h1 className="text-4xl font-display">
              {mode === "signup" ? "Join Activv" : "Welcome back"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "signup" ? "Curated matchmaking for serious athletes." : "Continue where you left off."}
            </p>
          </div>

          <div className="mt-7 grid grid-cols-2 p-1 rounded-full bg-muted text-xs font-medium">
            {(["signup", "login"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`py-2 rounded-full transition uppercase tracking-wider ${
                  mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {m === "signup" ? "Sign up" : "Log in"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <Field label="Full name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan Carter" maxLength={80} />
              </Field>
            )}
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" maxLength={120} />
            </Field>
            {mode === "signup" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Age">
                    <Input
                      type="number"
                      min={13}
                      max={99}
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="27"
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
                <Field label="City">
                  <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Chicago, IL" maxLength={80} />
                </Field>
              </>
            )}
            <Field label="Password">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" maxLength={64} />
            </Field>

            <Button type="submit" className="w-full font-semibold tracking-wide" size="lg" disabled={busy}>
              {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>
        </div>
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
