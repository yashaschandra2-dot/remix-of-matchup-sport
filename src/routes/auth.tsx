import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { ActivvLogo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { hydrateLocalFromSupabase, fetchProfileBundle, hasCompletedOnboarding } from "@/lib/supabase-profile";
import { toast } from "sonner";

const authSearchSchema = z.object({
  mode: z.enum(["signup", "login"]).optional().catch("signup"),
});

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in · Activv" }] }),
  validateSearch: authSearchSchema,
  component: AuthPage,
});

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "Incorrect email or password.";
  if (m.includes("email not confirmed")) return "Please confirm your email first — check your inbox.";
  if (m.includes("user not found") || m.includes("no user")) return "We couldn't find an account with that email.";
  if (m.includes("already registered") || m.includes("already exists")) return "An account with that email already exists. Try logging in.";
  if (m.includes("password should be")) return "Password must be at least 6 characters.";
  if (m.includes("rate limit")) return "Too many attempts. Please wait a moment and try again.";
  return message;
}

function AuthPage() {
  const { mode } = Route.useSearch();
  return <AuthForm initialMode={mode ?? "signup"} allowToggle />;
}

export function AuthForm({
  initialMode,
  allowToggle = false,
}: {
  initialMode: "signup" | "login";
  allowToggle?: boolean;
}) {
  const [mode, setMode] = useState<"signup" | "login">(initialMode);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!email.trim() || !password) {
          toast.error("Enter your email and password");
          return;
        }
        if (password.length < 6) {
          toast.error("Password must be at least 6 characters");
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/onboarding`,
          },
        });
        if (error) throw error;
        if (!data.session || !data.user) {
          toast.success("Check your inbox to confirm your email.");
          return;
        }
        await hydrateLocalFromSupabase(data.user.id, data.user.email ?? email.trim());
        toast.success("Account created — let's set up your profile");
        navigate({ to: "/onboarding" });
      } else {
        if (!email.trim() || !password) {
          toast.error("Enter your email and password");
          return;
        }
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        if (!data.user) throw new Error("Sign-in failed");
        const { profile, sports } = await fetchProfileBundle(data.user.id);
        await hydrateLocalFromSupabase(data.user.id, data.user.email ?? email.trim());
        const complete = hasCompletedOnboarding(profile, sports);
        toast.success("Welcome back");
        navigate({ to: complete ? "/home" : "/onboarding" });
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Something went wrong";
      const msg = friendlyAuthError(raw);
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

          {allowToggle && (
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
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" maxLength={120} />
            </Field>
            <Field label="Password">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" maxLength={64} />
            </Field>

            {mode === "login" && (
              <div className="text-right -mt-1">
                <Link
                  to="/forgot-password"
                  className="text-xs uppercase tracking-[0.18em] text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
            )}

            <Button type="submit" className="w-full font-semibold tracking-wide" size="lg" disabled={busy}>
              {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </Button>

            {mode === "signup" && (
              <p className="text-[11px] text-center text-muted-foreground">
                We'll ask for your sports, city & details on the next step.
              </p>
            )}

            <p className="text-[11px] text-center text-muted-foreground pt-2">
              {mode === "signup" ? (
                <>Already have an account?{" "}
                  <Link to="/login" className="text-primary hover:underline">Log in</Link>
                </>
              ) : (
                <>New to Activv?{" "}
                  <Link to="/signup" className="text-primary hover:underline">Create account</Link>
                </>
              )}
            </p>
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
