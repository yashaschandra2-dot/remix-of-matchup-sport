import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getUser } from "@/lib/activv-store";
import { searchNearbyCourts, type CourtPlace } from "@/lib/places.functions";
import { MapPin, Star, Navigation, Search, Loader2, RefreshCw, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/courts")({
  head: () => ({ meta: [{ title: "Find courts · Activv" }] }),
  component: CourtsPage,
});

const CHICAGO = { lat: 41.8781, lng: -87.6298 };

type LocStatus = "idle" | "locating" | "ok" | "denied" | "fallback";

function CourtsPage() {
  const navigate = useNavigate();
  const fetchCourts = useServerFn(searchNearbyCourts);

  const [locStatus, setLocStatus] = useState<LocStatus>("idle");
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [courts, setCourts] = useState<CourtPlace[]>([]);
  const [loadingCourts, setLoadingCourts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("All");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const u = getUser();
    if (!u) navigate({ to: "/auth" });
  }, [navigate]);

  const requestLocation = useCallback(() => {
    setLocStatus("locating");
    setError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setOrigin(CHICAGO);
      setLocStatus("fallback");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocStatus("ok");
      },
      () => {
        setOrigin(CHICAGO);
        setLocStatus("denied");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Fetch courts when origin changes
  useEffect(() => {
    if (!origin) return;
    let cancelled = false;
    setLoadingCourts(true);
    setError(null);
    fetchCourts({ data: { lat: origin.lat, lng: origin.lng, radius: 48280 } })
      .then((res) => {
        if (cancelled) return;
        setCourts(res.results);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        console.error(e);
        setError("Couldn't load nearby courts. Please try again.");
        setCourts([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCourts(false);
      });
    return () => {
      cancelled = true;
    };
  }, [origin, fetchCourts]);

  const allSports = useMemo(() => {
    const s = new Set<string>();
    for (const c of courts) {
      for (const t of c.types) {
        if (
          /tennis|basketball|cricket|boxing|volleyball|badminton|gym|sports|fitness|yoga|swimming/i.test(
            t,
          )
        ) {
          s.add(t.replace(/_/g, " "));
        }
      }
    }
    return Array.from(s).sort();
  }, [courts]);

  const list = useMemo(() => {
    return courts
      .filter((c) =>
        filter === "All"
          ? true
          : c.types.some((t) => t.replace(/_/g, " ") === filter),
      )
      .filter((c) =>
        query.trim()
          ? (c.name + " " + c.address).toLowerCase().includes(query.toLowerCase())
          : true,
      );
  }, [courts, filter, query]);

  const originLabel =
    locStatus === "ok"
      ? "Your location"
      : locStatus === "locating"
        ? "Locating you…"
        : "Chicago, IL";

  return (
    <AppShell>
      <BackButton />
      <section className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="chip">
            {locStatus === "locating" ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <MapPin className="size-3" />
            )}{" "}
            {originLabel}
          </span>
          <h1 className="mt-3 text-4xl sm:text-5xl font-display leading-tight">
            Find your <span className="text-gradient-brand">court</span>.
          </h1>
          <p className="mt-2 text-muted-foreground">
            Real-time sports facilities within 30 miles, sorted by distance.
          </p>
          {locStatus === "denied" && (
            <p className="mt-2 text-xs text-amber-500 flex items-center gap-1.5">
              <AlertTriangle className="size-3.5" /> Enable location for courts near you.
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={requestLocation} disabled={locStatus === "locating"}>
          <RefreshCw className={`size-3.5 ${locStatus === "locating" ? "animate-spin" : ""}`} />
          Refresh location
        </Button>
      </section>

      <section className="mb-6 surface-card rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <Search className="size-4 text-muted-foreground" />
          <Input
            inputMode="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or address"
            className="border-0 bg-transparent focus-visible:ring-0"
          />
        </div>
        {allSports.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {["All", ...allSports].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition capitalize ${
                  filter === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </section>

      {loadingCourts && (
        <div className="surface-card rounded-2xl p-8 flex items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="size-4 animate-spin" /> Finding courts near you…
        </div>
      )}

      {error && !loadingCourts && (
        <div className="surface-card rounded-2xl p-6 text-sm text-destructive">{error}</div>
      )}

      {!loadingCourts && !error && (
        <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground">
              No venues found within 30 miles. Try refreshing your location.
            </p>
          )}
          {list.map((c) => (
            <div key={c.id} className="surface-card rounded-2xl p-5 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-lg leading-tight">{c.name}</h3>
                {typeof c.rating === "number" && (
                  <span className="chip !py-1 shrink-0">
                    <Star className="size-3 text-primary" /> {c.rating.toFixed(1)}
                    {c.userRatingCount ? (
                      <span className="text-muted-foreground">({c.userRatingCount})</span>
                    ) : null}
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground flex items-start gap-1.5">
                <MapPin className="size-3.5 text-primary mt-0.5 shrink-0" /> {c.address}
              </p>
              {typeof c.openNow === "boolean" && (
                <p className={`mt-1 text-xs ${c.openNow ? "text-emerald-500" : "text-muted-foreground"}`}>
                  {c.openNow ? "Open now" : "Closed"}
                </p>
              )}
              {c.primaryType && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded-full border border-border text-muted-foreground capitalize">
                    {c.primaryType.replace(/_/g, " ")}
                  </span>
                </div>
              )}
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{(c.distanceKm * 0.621371).toFixed(1)} mi away</span>
                <Button
                  size="sm"
                  onClick={() => {
                    const dest = encodeURIComponent(c.address || `${c.lat},${c.lng}`);
                    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
                    const isIOS = /iPhone|iPad|iPod/i.test(ua);
                    const isAndroid = /Android/i.test(ua);
                    let url: string;
                    if (isIOS) {
                      url = `maps://maps.apple.com/?daddr=${dest}`;
                    } else if (isAndroid) {
                      url = `https://maps.google.com/?daddr=${dest}`;
                    } else {
                      url = `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
                    }
                    window.open(url, "_blank", "noopener,noreferrer");
                  }}
                >
                  <Navigation className="size-3.5" /> Directions
                </Button>
              </div>
            </div>
          ))}
        </section>
      )}
    </AppShell>
  );
}
