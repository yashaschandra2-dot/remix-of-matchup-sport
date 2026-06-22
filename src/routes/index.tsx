import { createFileRoute, Link } from "@tanstack/react-router";
import { ActivvLogo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Activv — Find your next game" },
      { name: "description", content: "Members-club matchmaking for serious athletes. Skill-matched games, premium courts, real-time analytics." },
      { property: "og:title", content: "Activv — Find your next game" },
      { property: "og:description", content: "Skill-matched matchmaking for serious athletes." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-4 py-6 sm:px-6 flex items-center justify-between max-w-6xl w-full mx-auto">
        <ActivvLogo />
        <Link to="/auth">
          <Button variant="ghost" size="sm">Sign in</Button>
        </Link>
      </header>

      <main className="flex-1 flex items-center px-4 py-10 sm:px-6">
        <div className="max-w-6xl w-full mx-auto grid lg:grid-cols-[1.1fr_1fr] gap-16 items-center">
          <div>
            <span className="chip mb-6">
              <Sparkles className="size-3 text-primary" />
              Members club · 40+ US cities
            </span>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display leading-[0.95]">
              Your <span className="text-gradient-brand italic">next game,</span><br />
              perfectly matched.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl">
              Activv pairs you with players at your level, secures the court, and keeps a live record
              of every minute on the field. A quieter, more refined way to play.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth">
                <Button size="lg" className="font-semibold">
                  Request access <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="secondary">I already have an account</Button>
              </Link>
            </div>

            <div className="mt-12 grid grid-cols-3 gap-6 max-w-md">
              <Stat value="12+" label="Sports" />
              <Stat value="3" label="Skill tiers" />
              <Stat value="24/7" label="Matchmaking" />
            </div>
          </div>

          <FeatureStack />
        </div>
      </main>

      <footer className="px-4 py-8 sm:px-6 text-center text-xs text-muted-foreground">
        © 2026 Activv — Built for athletes, by athletes.
      </footer>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-3xl font-display text-foreground">{value}</div>
      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function FeatureStack() {
  const items = [
    { emoji: "🎯", title: "Skill matchmaking", desc: "Beginner, Intermediate, Pro — never play out of your league." },
    { emoji: "📍", title: "Premium courts", desc: "Reserve curated venues across the US." },
    { emoji: "📊", title: "Real-time analytics", desc: "Live performance dashboard, refreshed every game." },
    { emoji: "🏆", title: "Trophy case", desc: "Win streaks, MVPs, lifetime stats." },
  ];
  return (
    <div className="relative">
      <div className="absolute -inset-10 rounded-[3rem] bg-primary/10 blur-3xl -z-10" aria-hidden />
      <div className="surface-luxe rounded-3xl p-6 grid grid-cols-2 gap-3">
        {items.map((it) => (
          <div key={it.title} className="rounded-2xl border border-border bg-background/40 p-5">
            <div className="text-3xl">{it.emoji}</div>
            <div className="mt-3 font-display text-lg">{it.title}</div>
            <div className="mt-1 text-sm text-muted-foreground">{it.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
