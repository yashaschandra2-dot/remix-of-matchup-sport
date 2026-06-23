import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell, SectionHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  getUser,
  SPORTS,
  leaveMatch,
  canLeaveMatch,
  isJoined,
  type ActivvUser,
  type JoinedMatch,
} from "@/lib/activv-store";
import {
  MapPin,
  Users,
  Clock,
  Trophy,
  Flame,
  Activity,
  Sparkles,
  LockKeyhole,
  Plus,
  CalendarPlus,
  Loader2,
  Crown,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { MatchDetailDialog, type MatchDetailActivity } from "@/components/match-detail-dialog";

export const Route = createFileRoute("/home")({
  head: () => ({ meta: [{ title: "Dashboard · Activv" }] }),
  component: Home,
});

const PIE_COLORS = ["oklch(0.82 0.13 85)", "oklch(0.65 0.16 45)", "oklch(0.55 0.10 80)", "oklch(0.45 0.06 60)"];

/** Points penalty (0 or negative) for leaving a match now. */
function leavePenaltyFor(scheduledAt: string): number {
  const minsUntil = (new Date(scheduledAt).getTime() - Date.now()) / 60000;
  if (minsUntil >= 45) return 0;
  if (minsUntil >= 30) return -5;
  if (minsUntil >= 10) return -10;
  if (minsUntil >= 0) return -15;
  return 0;
}

function leaveLabel(p: number): string {
  if (p === 0) return "Leave match (no penalty)";
  return `Leave match (${p} pts)`;
}

const US_STATE_ABBREV: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
  Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA",
  Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA",
  Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Missouri: "MO",
  Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ",
  "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH",
  Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT",
  Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY",
  "District of Columbia": "DC",
};
function stateAbbrev(name?: string): string | undefined {
  if (!name) return undefined;
  return US_STATE_ABBREV[name];
}

function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState<ActivvUser | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [openMatch, setOpenMatch] = useState<MatchDetailActivity | null>(null);
  const [liveLocation, setLiveLocation] = useState<string>("Locating…");

  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setLiveLocation("Location unavailable");
      return;
    }
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
            { headers: { Accept: "application/json" } },
          );
          if (!res.ok) throw new Error("reverse geocode failed");
          const j = await res.json();
          const a = j.address ?? {};
          const city =
            a.city || a.town || a.village || a.hamlet || a.suburb || a.county || a.state;
          const region = a.state_code || stateAbbrev(a.state) || a.state || a.country_code?.toUpperCase();
          const label = [city, region].filter(Boolean).join(", ");
          if (!cancelled) setLiveLocation(label || "Location unavailable");
        } catch {
          if (!cancelled) setLiveLocation("Location unavailable");
        }
      },
      () => {
        if (!cancelled) setLiveLocation("Location unavailable");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const u = getUser();
    if (!u) navigate({ to: "/auth" });
    else if (!u.sports.length) navigate({ to: "/onboarding" });
    else setUser(u);
  }, [navigate]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthUserId(data.session?.user.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthUserId(session?.user.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Real-time pulse — refresh "live" metrics every 3s
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(id);
  }, []);

  // Real user match history for analytics (declared after pointsQuery below via hoisted query call)
  const queryClient = useQueryClient();
  const matchesQuery = useQuery({
    queryKey: ["activities", "upcoming"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .gte("date_time", new Date().toISOString())
        .order("date_time", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Live Activv points from profiles, with realtime subscription
  const pointsQuery = useQuery({
    queryKey: ["profile-points", authUserId],
    queryFn: async () => {
      if (!authUserId) return 0;
      const { data, error } = await supabase
        .from("profiles")
        .select("points")
        .eq("id", authUserId)
        .maybeSingle();
      if (error) throw error;
      return (data?.points as number | undefined) ?? 0;
    },
    enabled: !!authUserId,
  });

  useEffect(() => {
    if (!authUserId) return;
    const channel = supabase
      .channel(`profile-points-${authUserId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${authUserId}` },
        (payload) => {
          const next = (payload.new as { points?: number } | null)?.points;
          if (typeof next === "number") {
            queryClient.setQueryData(["profile-points", authUserId], next);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [authUserId, queryClient]);

  // Realtime activities — keep "Full" badge / spots-left counters live
  // whenever anyone joins or leaves a match.
  useEffect(() => {
    const channel = supabase
      .channel("activities-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activities" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["activities", "upcoming"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Real user match history for analytics
  const userMatchesQuery = useQuery({
    queryKey: ["user-matches", authUserId],
    queryFn: async () => {
      if (!authUserId) return [] as UserMatchRow[];
      const { data, error } = await supabase
        .from("match_participants")
        .select("activity_id, joined_at, activities!inner(date_time, sport, duration_minutes)")
        .eq("user_id", authUserId);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        activity_id: r.activity_id as string,
        joined_at: r.joined_at as string,
        date_time: r.activities.date_time as string,
        sport: r.activities.sport as string,
        duration_minutes: (r.activities.duration_minutes ?? null) as number | null,
      }));
    },
    enabled: !!authUserId,
  });

  const data = useMemo(
    () => computeAnalytics(userMatchesQuery.data ?? []),
    [userMatchesQuery.data],
  );
  const hasHistory = (userMatchesQuery.data?.length ?? 0) > 0;
  void tick;



  if (!user) return null;
  const firstName = user.name.split(" ")[0];

  function refresh() {
    const u = getUser();
    if (u) setUser(u);
  }

  return (
    <AppShell>
      {/* Greeting */}
      <section className="mb-10">
        <span className="chip">
          <span className="size-1.5 rounded-full bg-primary animate-pulse" />
          Live · {liveLocation}
        </span>
        <h1 className="mt-3 text-4xl sm:text-5xl font-display leading-tight">
          Hey {firstName}, <span className="text-gradient-brand">on form today.</span>
        </h1>
        <p className="mt-2 text-muted-foreground">Your athletic dashboard, refreshed every few seconds.</p>
      </section>

      {/* KPI cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Kpi icon={<Trophy className="size-4" />} label="Win rate" value={`${data.winRate}%`} delta={hasHistory ? "from your matches" : "—"} up={hasHistory && data.winRate > 0} />
        <Kpi icon={<Flame className="size-4" />} label="Streak" value={`${data.streak}`} delta={data.streak > 0 ? "days in a row" : "—"} />
        <Kpi icon={<Activity className="size-4" />} label="Active mins" value={formatActiveMins(data.activeMins)} delta="this week" />
        <Kpi icon={<Sparkles className="size-4" />} label="Activv points" value={`${pointsQuery.data ?? 0}`} delta="live" up />
      </section>
      {!hasHistory && (
        <p className="mb-10 text-sm text-muted-foreground">Join matches to see your stats</p>
      )}
      {hasHistory && <div className="mb-10" />}


      {/* Joined matches */}
      {user.joinedMatches.length > 0 && (
        <section className="mb-10">
          <SectionHeader eyebrow="Upcoming" title="Your games" />
          <div className="grid sm:grid-cols-2 gap-4">
            {user.joinedMatches.map((m) => (
              <JoinedCard
                key={m.id}
                match={m}
                tick={tick}
                onLeft={(penalty) => {
                  const ok = canLeaveMatch(m.scheduledAt);
                  if (!ok) {
                    toast.error("Locked — within 30 min of start");
                    return;
                  }
                  leaveMatch(m.id);
                  toast.success(
                    penalty === 0
                      ? `Left ${m.sport} match`
                      : `Left ${m.sport} match (${penalty} pts)`,
                  );
                  refresh();
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Live performance + sport distribution */}
      {/* Live performance + sport distribution */}
      {hasHistory && (
      <section className="grid lg:grid-cols-3 gap-4 mb-10">
        <div className="surface-luxe rounded-3xl p-6 lg:col-span-2">
          <SectionHeader eyebrow="Real-time" title="Performance — last 14 days" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.performance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.82 0.13 85)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="oklch(0.82 0.13 85)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" />
                <XAxis dataKey="day" stroke="oklch(0.68 0.015 75)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.68 0.015 75)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.12 0.012 60)",
                    border: "1px solid oklch(1 0 0 / 0.1)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="score" stroke="oklch(0.82 0.13 85)" strokeWidth={2} fill="url(#gold)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface-luxe rounded-3xl p-6">
          <SectionHeader eyebrow="Distribution" title="Time per sport" />
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.distribution} dataKey="value" innerRadius={45} outerRadius={75} paddingAngle={3} stroke="none">
                  {data.distribution.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.12 0.012 60)",
                    border: "1px solid oklch(1 0 0 / 0.1)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 space-y-1.5 text-sm">
            {data.distribution.map((d, i) => (
              <li key={d.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {d.name}
                </span>
                <span className="text-muted-foreground">{d.value}h</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
      )}



      {/* Real matches from Supabase */}
      <section className="mb-4">
        <SectionHeader
          eyebrow="Live"
          title="Upcoming matches"
          action={
            <Link to="/create-match">
              <Button size="sm"><Plus className="size-4" /> Create match</Button>
            </Link>
          }
        />
        {matchesQuery.isLoading ? (
          <div className="surface-card rounded-2xl p-10 flex items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin mr-2" /> Loading matches…
          </div>
        ) : matchesQuery.isError ? (
          <div className="surface-card rounded-2xl p-6 text-destructive">
            Couldn't load matches. {(matchesQuery.error as Error)?.message}
          </div>
        ) : !matchesQuery.data || matchesQuery.data.length === 0 ? (
          <div className="surface-card rounded-2xl p-10 text-center">
            <CalendarPlus className="size-10 mx-auto text-primary/70" />
            <h3 className="mt-3 font-display text-xl">No matches yet — be the first to create one!</h3>
            <p className="mt-1 text-sm text-muted-foreground">Set up a game and invite players in your area.</p>
            <Link to="/create-match">
              <Button className="mt-5"><Plus className="size-4" /> Create match</Button>
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {matchesQuery.data.map((a) => {
              const emoji = SPORTS.find((s) => s.name === a.sport)?.emoji ?? "🏅";
              const spotsLeft = Math.max(0, a.max_players - a.current_players);
              const joined = isJoined(a.id);
              const isCreator = !!authUserId && a.creator_id === authUserId;
              return (
                <ActivityCard
                  key={a.id}
                  activity={a}
                  emoji={emoji}
                  spotsLeft={spotsLeft}
                  joined={joined}
                  isCreator={isCreator}
                  onOpen={() => setOpenMatch(a as MatchDetailActivity)}
                />
              );
            })}
          </div>
        )}
      </section>

      <MatchDetailDialog
        activity={openMatch}
        authUserId={authUserId}
        open={!!openMatch}
        onOpenChange={(o) => !o && setOpenMatch(null)}
        onChanged={() => {
          refresh();
          queryClient.invalidateQueries({ queryKey: ["activities", "upcoming"] });
          queryClient.invalidateQueries({ queryKey: ["profile-points", authUserId] });
        }}
      />
    </AppShell>
  );
}

function Kpi({
  icon, label, value, delta, up,
}: { icon: React.ReactNode; label: string; value: string; delta: string; up?: boolean }) {
  return (
    <div className="surface-card rounded-2xl p-4">
      <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em]">
        {icon} {label}
      </div>
      <div className="mt-1.5 text-3xl font-display">{value}</div>
      <div className={`mt-1 text-[11px] ${up ? "text-primary" : "text-muted-foreground"}`}>{delta}</div>
    </div>
  );
}

type ActivityRow = {
  id: string;
  sport: string;
  title: string;
  location: string;
  date_time: string;
  skill_level: string;
  max_players: number;
  current_players: number;
};

function ActivityCard({
  activity: a,
  emoji,
  spotsLeft,
  joined,
  isCreator,
  onOpen,
}: {
  activity: ActivityRow;
  emoji: string;
  spotsLeft: number;
  joined: boolean;
  isCreator: boolean;
  onOpen: () => void;
}) {
  const when = new Date(a.date_time);
  const whenLabel = when.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const full = spotsLeft <= 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="surface-card rounded-2xl p-5 hover:border-primary/60 transition text-left w-full"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl">{emoji}</span>
          <div className="min-w-0">
            <div className="font-display text-lg truncate">{a.title}</div>
            <div className="text-xs text-muted-foreground">{a.sport}</div>
          </div>
        </div>
        <span className="chip !py-1 shrink-0">{a.skill_level}</span>
      </div>
      <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
        <div className="flex items-center gap-2"><MapPin className="size-4 text-primary" /> {a.location}</div>
        <div className="flex items-center gap-2"><Clock className="size-4 text-primary" /> {whenLabel}</div>
        <div className="flex items-center gap-2">
          <Users className="size-4 text-primary" />
          {full ? "Full" : `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`} · {a.current_players}/{a.max_players}
        </div>
      </div>
      {isCreator ? (
        <div className="mt-4 w-full rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary text-center flex items-center justify-center gap-1.5">
          <Crown className="size-4" /> You created this
        </div>
      ) : joined ? (
        <div className="mt-4 w-full rounded-md border border-primary/40 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary text-center">
          Joined · tap for details
        </div>
      ) : full ? (
        <div className="mt-4 w-full rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground text-center flex items-center justify-center gap-1.5">
          <LockKeyhole className="size-4" /> Match full
        </div>
      ) : (
        <div className="mt-4 w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground text-center">
          View & join · +25 pts
        </div>
      )}
    </button>
  );
}

function JoinedCard({
  match: m,
  onLeft,
  tick: _tick,
}: {
  match: JoinedMatch;
  onLeft: (penalty: number) => void;
  tick?: number;
}) {
  void _tick;
  const canLeave = canLeaveMatch(m.scheduledAt);
  const penalty = leavePenaltyFor(m.scheduledAt);
  const when = new Date(m.scheduledAt);
  return (
    <div className="surface-card rounded-2xl p-5 border-primary/40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{m.emoji}</span>
          <span className="font-display text-lg">{m.sport}</span>
        </div>
        <span className="chip !py-1 border-primary/40 text-primary">Joined</span>
      </div>
      <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
        <div className="flex items-center gap-2"><MapPin className="size-4 text-primary" /> {m.venue}</div>
        <div className="flex items-center gap-2"><Clock className="size-4 text-primary" /> {when.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}</div>
      </div>
      {canLeave ? (
        <Button variant="secondary" className="mt-4 w-full" onClick={() => onLeft(penalty)}>
          {leaveLabel(penalty)}
        </Button>
      ) : (
        <Button variant="secondary" className="mt-4 w-full" disabled>
          <LockKeyhole className="size-4" /> Within 30 min — leave locked
        </Button>
      )}
    </div>
  );
}


type UserMatchRow = {
  activity_id: string;
  joined_at: string;
  date_time: string;
  sport: string;
  duration_minutes: number | null;
};

function formatActiveMins(total: number): string {
  if (!total || total <= 0) return "0m";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function computeAnalytics(matches: UserMatchRow[]) {
  const now = new Date();
  const startedJoined = matches.filter((m) => new Date(m.date_time) <= now);
  const winRate = matches.length === 0 ? 0 : Math.round((startedJoined.length / matches.length) * 100);

  // Streak: consecutive days ending today with at least one match (joined or scheduled)
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const activeDays = new Set(matches.map((m) => dayKey(new Date(m.date_time))));
  let streak = 0;
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  while (activeDays.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Active mins this week (Mon–Sun) — 90 mins per joined match
  const weekStart = new Date(now);
  const dow = (weekStart.getDay() + 6) % 7; // Mon=0
  weekStart.setDate(weekStart.getDate() - dow);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  // Sum actual duration_minutes for matches that have already started this week.
  // Matches without a set duration are excluded rather than estimated.
  const inWeek = matches.filter((m) => {
    const t = new Date(m.date_time);
    return t >= weekStart && t < weekEnd && t <= now && m.duration_minutes != null;
  });
  const activeMins = inWeek.reduce((sum, m) => sum + (m.duration_minutes ?? 0), 0);

  // Performance — last 14 days, points earned per day (approx 25 pts per join, by joined_at)
  const performance: { day: string; score: number }[] = [];
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    const joinsThatDay = matches.filter((m) => dayKey(new Date(m.joined_at)) === key).length;
    performance.push({ day: dayLabels[d.getDay()], score: joinsThatDay * 25 });
  }

  // Distribution — hours per sport (1.5h per match)
  const bySport = new Map<string, number>();
  for (const m of matches) {
    bySport.set(m.sport, (bySport.get(m.sport) ?? 0) + 1.5);
  }
  const distribution = Array.from(bySport.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, value]) => ({ name, value: Math.round(value * 10) / 10 }));

  return { winRate, streak, activeMins, performance, distribution };
}

