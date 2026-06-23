import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ActivvLogo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Set new password · Activv" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase emits PASSWORD_RECOVERY when the link is opened.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // Also true if a session already exists from the recovery link.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated");
      navigate({ to: "/home" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
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
            <p className="text-[11px] uppercase tracking-[0.25em] text-primary mb-3">Account</p>
            <h1 className="text-4xl font-display">Set new password</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {ready
                ? "Choose a new password for your account."
                : "Open this page from the reset link in your email."}
            </p>
          </div>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">New password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                maxLength={64}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Confirm password</Label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                maxLength={64}
              />
            </div>
            <Button type="submit" size="lg" className="w-full font-semibold" disabled={busy || !ready}>
              {busy ? "Updating…" : "Update password"}
            </Button>
            <div className="text-center">
              <Link to="/auth" className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-primary">
                Back to sign in
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}