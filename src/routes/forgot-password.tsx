import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ActivvLogo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset password · Activv" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!email.trim()) {
      toast.error("Enter your email");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("Check your inbox for a reset link");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email");
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
            <h1 className="text-4xl font-display">Reset password</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {sent
                ? "We sent you a link to reset your password."
                : "We'll email you a secure link to set a new password."}
            </p>
          </div>

          {!sent ? (
            <form onSubmit={submit} className="mt-7 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  maxLength={120}
                />
              </div>
              <Button type="submit" size="lg" className="w-full font-semibold" disabled={busy}>
                {busy ? "Sending…" : "Send reset link"}
              </Button>
              <div className="text-center">
                <Link to="/auth" className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-primary">
                  Back to sign in
                </Link>
              </div>
            </form>
          ) : (
            <div className="mt-7 space-y-3">
              <Button size="lg" className="w-full font-semibold" onClick={() => navigate({ to: "/auth" })}>
                Back to sign in
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}