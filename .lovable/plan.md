
## Changes

### 1. Auth simplification (`src/routes/auth.tsx`)
- Remove Google and Apple sign-in buttons entirely. Email-only.
- Sign-up form gains required fields: **Age** (number, 13–99) and **Gender** (Male / Female / Other / Prefer not to say) via a Select.
- Default city set to **Chicago, IL** (pre-filled, editable).

### 2. Store updates (`src/lib/activv-store.ts`)
- Add `age?: number` and `gender?: "Male" | "Female" | "Other" | "Prefer not to say"` to `ActivvUser`.
- Add `points: number` (rewards balance) and `joinedMatches: JoinedMatch[]` where `JoinedMatch = { id, sport, venue, scheduledAt (ISO), level }`.
- Helper functions: `joinMatch(match)`, `leaveMatch(id)`, `canLeaveMatch(scheduledAt)` returns true if `now < scheduledAt - 30min`, `addPoints(n, reason)`.
- Expand `SPORTS` list to include **Yoga, Swimming, Cycling, Hiking, Boxing, Squash, Rock Climbing, Skating** (in addition to existing).

### 3. Logo + wordmark (`src/components/brand.tsx`)
- Keep image size unchanged but apply CSS `object-cover` + `scale-[1.6]` inside a clipped rounded container so the logo art zooms without growing the bounding box.
- Render **"Activv"** wordmark beside the logo by default in `ActivvLogo` (prop `withWordmark` defaults to true), used in header + landing.

### 4. Profile page fix (`src/routes/profile.tsx`)
- Investigate the runtime error (likely `user!` access or missing field). Add safe guards and an `errorComponent`.
- Surface real-time data: pull the same live analytics generator used on the home dashboard (win rate, streak, Activv score, performance area chart, sport distribution pie) into the profile, scoped under a "Live performance" section.
- Show new fields: Age, Gender, Points balance, Joined matches list with Leave button (when eligible).

### 5. Find Courts & Locations (new route `src/routes/courts.tsx`)
- New nav item "Courts" in `app-shell.tsx`.
- Uses Google Maps Platform connector (already available in env).
  - Browser key for an embedded interactive map centered on Chicago.
  - **Places API (New)** via gateway `places/v1/places:searchNearby` from a server function `src/lib/courts.functions.ts` to fetch sports facilities (basketball courts, tennis courts, gyms, yoga studios) near user's city.
  - Falls back to Chicago coordinates (41.8781, -87.6298) when the user has no city.
- Card list with name, address, distance, rating + a "Get directions" link to Google Maps.
- Filter chips by sport.

### 6. Match join/leave flow (`src/routes/home.tsx` + new `src/routes/matches.tsx`)
- Each generated match gets a stable `id` and a real `scheduledAt` Date.
- "Join match" button calls `joinMatch()`, awards **+25 points**, toasts success, swaps to a "Joined ✓" state.
- For joined matches, render a **Leave** button that is enabled only when `canLeaveMatch` is true (>30 min before start). Otherwise show "Locked — within 30 min of start" with a Clock icon.
- Profile + Home both show user's joined matches in a "Your upcoming games" section with the same leave logic.

### 7. Reward system
- Per the Playo-style PPT logic, implement a simple, transparent points ledger:
  - +25 points: join a match
  - +100 points: complete a match (mocked button "Mark complete" on past joined matches)
  - +50 points: 3-day streak bonus
  - −10 points: leaving a match (still allowed >30 min before)
- Display **Points** KPI on home dashboard and a **Rewards** card on profile listing recent ledger entries (`rewards: { ts, delta, reason }[]`).
- Tier badge derived from points: Rookie (<500), Pro (<1500), Elite (<3000), Legend (3000+) — shown on profile.

### 8. Onboarding sports
- New sports flow into the existing grid; no other change needed beyond the SPORTS array expansion.

## Connectors / secrets
- Google Maps Platform connector is already linked (env vars present). No new secrets needed.

## Files touched
- edit: `src/lib/activv-store.ts`, `src/components/brand.tsx`, `src/components/app-shell.tsx`, `src/routes/auth.tsx`, `src/routes/home.tsx`, `src/routes/profile.tsx`, `src/routes/onboarding.tsx`, `src/routeTree.gen.ts` is auto-generated (skip).
- create: `src/routes/courts.tsx`, `src/lib/courts.functions.ts`, `src/lib/rewards.ts`.

## Notes
- All data still client-side (localStorage) — no Lovable Cloud yet. When you want real persistence + auth, we can flip that on.
- The "real-time" analytics remain a deterministic seeded simulation refreshed every 3s; with Cloud enabled later we can wire actual match history.
