import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, SectionHeader } from "@/components/app-shell";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { SPORTS, LEVELS } from "@/lib/activv-store";
import { searchNearbyCourts, type CourtPlace } from "@/lib/places.functions";
import { toast } from "sonner";
import { Loader2, MapPin, User, Users, Search, Check, X, CalendarIcon, Clock } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/create-match")({
  head: () => ({ meta: [{ title: "Create match · Activv" }] }),
  component: CreateMatch,
});

type PlayMode = "Solo" | "Group";

function CreateMatch() {
  const navigate = useNavigate();
  const fetchCourts = useServerFn(searchNearbyCourts);

  const [userId, setUserId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    sport: "Tennis",
    title: "",
    description: "",
    location: "",
    date: "",
    time: "",
    skill_level: "Intermediate",
    max_players: 4,
    play_mode: "Solo" as PlayMode,
    group_size: 2,
    duration_minutes: null as number | null,
  });

  // Location picker state
  const [courts, setCourts] = useState<CourtPlace[]>([]);
  const [loadingCourts, setLoadingCourts] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [locQuery, setLocQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [pickedFromList, setPickedFromList] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error || !data.session) {
        navigate({ to: "/auth" });
        return;
      }
      setUserId(data.session.user.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/auth" });
      else setUserId(session.user.id);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  // Load nearby courts (30 miles ≈ 48280m)
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocError("Geolocation unavailable. You can type a location instead.");
      return;
    }
    setLoadingCourts(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetchCourts({
          data: { lat: pos.coords.latitude, lng: pos.coords.longitude, radius: 48280 },
        })
          .then((res) => setCourts(res.results))
          .catch(() => setLocError("Couldn't load nearby venues. Type a location instead."))
          .finally(() => setLoadingCourts(false));
      },
      () => {
        setLoadingCourts(false);
        setLocError("Location permission denied. You can type a location instead.");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }, [fetchCourts]);

  const filteredCourts = useMemo(() => {
    const q = locQuery.trim().toLowerCase();
    if (!q) return courts;
    return courts.filter((c) =>
      (c.name + " " + c.address).toLowerCase().includes(q),
    );
  }, [courts, locQuery]);

  function pickCourt(c: CourtPlace) {
    const label = c.address ? `${c.name} — ${c.address}` : c.name;
    setForm((f) => ({ ...f, location: label }));
    setLocQuery(label);
    setPickedFromList(true);
    setShowSuggestions(false);
  }

  function clearLocation() {
    setForm((f) => ({ ...f, location: "" }));
    setLocQuery("");
    setPickedFromList(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const location = (form.location || locQuery).trim();
    if (!location) {
      toast.error("Please pick or enter a location.");
      return;
    }
    if (!form.date || !form.time) {
      toast.error("Please pick a date and a time.");
      return;
    }
    const dt = new Date(`${form.date}T${form.time}`);
    if (Number.isNaN(dt.getTime())) {
      toast.error("Invalid date & time.");
      return;
    }

    setSubmitting(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setSubmitting(false);
      toast.error("Your session expired. Please sign in again.");
      navigate({ to: "/auth" });
      return;
    }
    const uid = userId ?? sessionData.session.user.id;
    const groupSize = form.play_mode === "Group" ? Math.max(1, Number(form.group_size)) : null;
    const creatorParty = form.play_mode === "Group" ? Math.max(1, groupSize ?? 1) : 1;
    const othersNeeded = Math.max(0, Number(form.max_players));
    const totalCapacity = creatorParty + othersNeeded;
    const titleFallback = `${form.sport} • ${form.skill_level}`;
    const { error } = await supabase.from("activities").insert({
      creator_id: uid,
      sport: form.sport,
      title: form.title.trim() || titleFallback,
      description: form.description || null,
      location,
      date_time: dt.toISOString(),
      skill_level: form.skill_level,
      max_players: totalCapacity,
      current_players: creatorParty,
      play_mode: form.play_mode,
      group_size: groupSize,
      notes: form.description || null,
      duration_minutes: form.duration_minutes,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Match created");
    navigate({ to: "/home" });
  }

  return (
    <AppShell>
      <section className="max-w-2xl">
        <BackButton />
        <SectionHeader eyebrow="New" title="Create a match" />
        <form onSubmit={onSubmit} className="surface-card rounded-2xl p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Sport</Label>
              <Select value={form.sport} onValueChange={(v) => setForm({ ...form, sport: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SPORTS.map((s) => (
                    <SelectItem key={s.name} value={s.name}>
                      {s.emoji} {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Skill level</Label>
              <Select
                value={form.skill_level}
                onValueChange={(v) => setForm({ ...form, skill_level: v })}
              >
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                  <SelectItem value="All">All levels</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="title">
              Title <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="title"
              className="mt-1.5"
              placeholder="Saturday morning doubles"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              className="mt-1.5"
              rows={3}
              placeholder="What's the match about? Bring extra balls, casual play, etc."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {/* Smart location picker */}
          <div>
            <Label htmlFor="location">Location</Label>
            <div className="relative mt-1.5">
              <div className="flex items-center gap-2 rounded-md border border-input bg-transparent px-3 focus-within:ring-1 focus-within:ring-ring">
                <MapPin className="size-4 text-muted-foreground shrink-0" />
                <input
                  id="location"
                  type="text"
                  value={locQuery}
                  placeholder={
                    loadingCourts ? "Loading nearby venues…" : "Search nearby courts or type a location"
                  }
                  onChange={(e) => {
                    setLocQuery(e.target.value);
                    setForm((f) => ({ ...f, location: e.target.value }));
                    setPickedFromList(false);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  className="flex-1 bg-transparent py-2 text-base md:text-sm outline-none placeholder:text-muted-foreground"
                />
                {loadingCourts && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                {locQuery && !loadingCourts && (
                  <button
                    type="button"
                    onClick={clearLocation}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Clear location"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>

              {showSuggestions && filteredCourts.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-72 overflow-y-auto">
                  {filteredCourts.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickCourt(c)}
                      className="w-full text-left px-3 py-2 hover:bg-accent flex items-start gap-2 border-b border-border/50 last:border-b-0"
                    >
                      <MapPin className="size-3.5 text-primary mt-1 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.address}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0 mt-1">
                        {(c.distanceKm * 0.621371).toFixed(1)} mi
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1.5">
              {pickedFromList ? (
                <>
                  <Check className="size-3 text-emerald-500" /> Picked from nearby venues
                </>
              ) : locError ? (
                locError
              ) : courts.length > 0 ? (
                <>
                  <Search className="size-3" /> {courts.length} nearby venues within 30 miles — or type your own
                </>
              ) : (
                "Type a location, or allow location access to see nearby venues."
              )}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Date</Label>
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "mt-1.5 w-full justify-start text-left font-normal h-11",
                      !form.date && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="size-4" />
                    {form.date
                      ? format(new Date(`${form.date}T00:00`), "EEEE, MMM d yyyy")
                      : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.date ? new Date(`${form.date}T00:00`) : undefined}
                    onSelect={(d) => {
                      if (!d) return;
                      setForm({ ...form, date: format(d, "yyyy-MM-dd") });
                      setDateOpen(false);
                    }}
                    disabled={(d) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      return d < today;
                    }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Time</Label>
              <TimePicker
                value={form.time}
                onChange={(t) => setForm({ ...form, time: t })}
              />
            </div>
          </div>


          <div>
            <Label htmlFor="mp">Additional players needed</Label>
            <Input
              id="mp"
              type="number"
              min={1}
              max={20}
              className="mt-1.5"
              value={form.max_players}
              onChange={(e) => setForm({ ...form, max_players: Number(e.target.value) })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              How many more players you need (excluding you{form.play_mode === "Group" ? " and your group" : ""}). Total capacity:{" "}
              {(form.play_mode === "Group" ? Math.max(1, Number(form.group_size) || 1) : 1) + Math.max(0, Number(form.max_players) || 0)}.
            </p>
          </div>

          <div>
            <Label>
              Match duration <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <DurationPicker
              value={form.duration_minutes}
              onChange={(d: number | null) => setForm({ ...form, duration_minutes: d })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Used to track Active Minutes on the dashboard. Leave empty to skip.
            </p>
          </div>

          <div>
            <Label>Playing mode</Label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(["Solo", "Group"] as PlayMode[]).map((mode) => {
                const active = form.play_mode === mode;
                const Icon = mode === "Solo" ? User : Users;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setForm({ ...form, play_mode: mode })}
                    className={`rounded-xl px-4 py-3 border text-sm font-medium flex items-center justify-center gap-2 transition ${
                      active
                        ? "bg-primary/10 text-primary border-primary/40"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-4" /> {mode}
                  </button>
                );
              })}
            </div>
          </div>

          {form.play_mode === "Group" && (
            <div>
              <Label htmlFor="gs">Group size</Label>
              <Input
                id="gs"
                type="number"
                min={1}
                max={10}
                className="mt-1.5"
                value={form.group_size}
                onChange={(e) =>
                  setForm({ ...form, group_size: Number(e.target.value) })
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">
                How many players are joining with you (1–10).
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={submitting} className="flex-1">
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Creating…
                </>
              ) : (
                "Create match"
              )}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate({ to: "/home" })}
            >
              Cancel
            </Button>
          </div>
        </form>
      </section>
    </AppShell>
  );
}

function TimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [hStr, mStr] = value ? value.split(":") : ["", ""];
  const h24 = hStr ? parseInt(hStr, 10) : null;
  const minute = mStr ?? "";
  const period: "AM" | "PM" = h24 == null ? "AM" : h24 >= 12 ? "PM" : "AM";
  const hour12 = h24 == null ? "" : String(((h24 + 11) % 12) + 1);

  function emit(h12: string, m: string, p: "AM" | "PM") {
    if (!h12 || !m) return;
    let h = parseInt(h12, 10) % 12;
    if (p === "PM") h += 12;
    onChange(`${String(h).padStart(2, "0")}:${m}`);
  }

  const friendly =
    h24 != null && minute
      ? format(new Date(2000, 0, 1, h24, parseInt(minute, 10)), "h:mm a")
      : "";

  return (
    <div className="mt-1.5 space-y-1.5">
      <div className="grid grid-cols-3 gap-2">
        <Select
          value={hour12}
          onValueChange={(v) => emit(v, minute || "00", period)}
        >
          <SelectTrigger className="h-11">
            <Clock className="size-4 text-muted-foreground" />
            <SelectValue placeholder="Hour" />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((h) => (
              <SelectItem key={h} value={h}>
                {h}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={minute}
          onValueChange={(v) => emit(hour12 || "12", v, period)}
        >
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Min" />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) =>
              String(i * 5).padStart(2, "0"),
            ).map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={period}
          onValueChange={(v) => emit(hour12 || "12", minute || "00", v as "AM" | "PM")}
        >
          <SelectTrigger className="h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {friendly && (
        <p className="text-xs text-muted-foreground">{friendly}</p>
      )}
    </div>
  );
}

const DURATION_PRESETS: { label: string; minutes: number }[] = [
  { label: "30 mins", minutes: 30 },
  { label: "45 mins", minutes: 45 },
  { label: "1 hour", minutes: 60 },
  { label: "1.5 hours", minutes: 90 },
  { label: "2 hours", minutes: 120 },
  { label: "2.5 hours", minutes: 150 },
  { label: "3 hours", minutes: 180 },
];

function DurationPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const isPreset = value != null && DURATION_PRESETS.some((p) => p.minutes === value);
  const [custom, setCustom] = useState<boolean>(value != null && !isPreset);
  const [customMins, setCustomMins] = useState<string>(value != null && !isPreset ? String(value) : "");

  return (
    <div className="mt-1.5 space-y-2">
      <div className="flex flex-wrap gap-2">
        {DURATION_PRESETS.map((p) => {
          const active = !custom && value === p.minutes;
          return (
            <button
              key={p.minutes}
              type="button"
              onClick={() => {
                setCustom(false);
                onChange(p.minutes);
              }}
              className={`rounded-full px-3 py-1.5 border text-xs font-medium transition ${
                active
                  ? "bg-primary/10 text-primary border-primary/40"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            setCustom(true);
            const n = customMins ? Number(customMins) : NaN;
            onChange(Number.isFinite(n) && n > 0 ? n : null);
          }}
          className={`rounded-full px-3 py-1.5 border text-xs font-medium transition ${
            custom
              ? "bg-primary/10 text-primary border-primary/40"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          Custom
        </button>
        {(value != null || custom) && (
          <button
            type="button"
            onClick={() => {
              setCustom(false);
              setCustomMins("");
              onChange(null);
            }}
            className="rounded-full px-3 py-1.5 border border-border text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>
      {custom && (
        <Input
          type="number"
          min={5}
          max={600}
          placeholder="Minutes"
          value={customMins}
          onChange={(e) => {
            setCustomMins(e.target.value);
            const n = Number(e.target.value);
            onChange(Number.isFinite(n) && n > 0 ? n : null);
          }}
        />
      )}
    </div>
  );
}

