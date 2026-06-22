import { createServerFn } from "@tanstack/react-start";

const SPORT_QUERIES = [
  "sports court",
  "gym",
  "tennis court",
  "basketball court",
  "cricket ground",
  "football field",
  "volleyball court",
  "badminton court",
  "swimming pool",
  "golf course",
];

export interface CourtPlace {
  id: string;
  name: string;
  address: string;
  rating?: number;
  userRatingCount?: number;
  lat: number;
  lng: number;
  types: string[];
  primaryType?: string;
  openNow?: boolean;
  distanceKm: number;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export const searchNearbyCourts = createServerFn({ method: "POST" })
  .inputValidator((input: { lat: number; lng: number; radius?: number }) => {
    if (typeof input?.lat !== "number" || typeof input?.lng !== "number") {
      throw new Error("lat and lng are required numbers");
    }
    const radius = Math.min(Math.max(input.radius ?? 20000, 100), 50000);
    return { lat: input.lat, lng: input.lng, radius };
  })
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!lovableKey || !mapsKey) {
      throw new Error("Google Maps connector is not configured");
    }

    const url = "https://connector-gateway.lovable.dev/google_maps/places/v1/places:searchText";
    const fieldMask = [
      "places.id",
      "places.displayName",
      "places.formattedAddress",
      "places.location",
      "places.rating",
      "places.userRatingCount",
      "places.types",
      "places.primaryType",
      "places.currentOpeningHours.openNow",
    ].join(",");

    const seen = new Map<string, CourtPlace>();

    await Promise.all(
      SPORT_QUERIES.map(async (sport) => {
        const body = {
          textQuery: sport,
          maxResultCount: 20,
          locationBias: {
            circle: {
              center: { latitude: data.lat, longitude: data.lng },
              radius: data.radius,
            },
          },
        };
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": mapsKey,
            "Content-Type": "application/json",
            "X-Goog-FieldMask": fieldMask,
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const text = await res.text();
          console.error(`Places search failed for ${sport}:`, res.status, text);
          return;
        }
        const json = (await res.json()) as { places?: any[] };
        for (const p of json.places ?? []) {
          if (!p.id || seen.has(p.id)) continue;
          const lat = p.location?.latitude;
          const lng = p.location?.longitude;
          if (typeof lat !== "number" || typeof lng !== "number") continue;
          seen.set(p.id, {
            id: p.id,
            name: p.displayName?.text ?? "Unnamed venue",
            address: p.formattedAddress ?? "",
            rating: p.rating,
            userRatingCount: p.userRatingCount,
            lat,
            lng,
            types: p.types ?? [],
            primaryType: p.primaryType,
            openNow: p.currentOpeningHours?.openNow,
            distanceKm: haversineKm({ lat: data.lat, lng: data.lng }, { lat, lng }),
          });
        }
      }),
    );

    const results = Array.from(seen.values())
      .filter((p) => p.distanceKm <= data.radius / 1000 + 0.5)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return { results };
  });
