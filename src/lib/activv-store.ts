// Lightweight client-only store for the Activv Connect MVP prototype.
export type SkillLevel = "Beginner" | "Intermediate" | "Pro";
export type Gender = "Male" | "Female" | "Other" | "Prefer not to say";

export interface SportPick {
  sport: string;
  level: SkillLevel;
}

export interface JoinedMatch {
  id: string;
  sport: string;
  emoji: string;
  level: SkillLevel | string;
  venue: string;
  scheduledAt: string; // ISO
  joinedAt: string;
  completed?: boolean;
}

export interface RewardEntry {
  ts: string;
  delta: number;
  reason: string;
}

export interface ActivvUser {
  id: string;
  name: string;
  email: string;
  city?: string;
  age?: number;
  gender?: Gender;
  avatarUrl?: string;
  provider?: "email" | "google" | "apple";
  sports: SportPick[];
  createdAt: string;
  bio?: string;
  points: number;
  joinedMatches: JoinedMatch[];
  rewards: RewardEntry[];
}

const KEY = "activv.user";

function ensureDefaults(u: ActivvUser): ActivvUser {
  return {
    ...u,
    points: typeof u.points === "number" ? u.points : 0,
    joinedMatches: Array.isArray(u.joinedMatches) ? u.joinedMatches : [],
    rewards: Array.isArray(u.rewards) ? u.rewards : [],
    sports: Array.isArray(u.sports) ? u.sports : [],
  };
}

export function getUser(): ActivvUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    return ensureDefaults(JSON.parse(raw) as ActivvUser);
  } catch {
    return null;
  }
}

export function saveUser(user: ActivvUser) {
  window.localStorage.setItem(KEY, JSON.stringify(ensureDefaults(user)));
}

export function updateUser(patch: Partial<ActivvUser>) {
  const cur = getUser();
  if (!cur) return null;
  const next = ensureDefaults({ ...cur, ...patch });
  saveUser(next);
  return next;
}

export function signOut() {
  window.localStorage.removeItem(KEY);
}

export function createUser(input: {
  name: string;
  email: string;
  city?: string;
  age?: number;
  gender?: Gender;
  provider?: ActivvUser["provider"];
  avatarUrl?: string;
}): ActivvUser {
  const user: ActivvUser = {
    id: crypto.randomUUID(),
    name: input.name,
    email: input.email,
    city: input.city ?? "Chicago, IL",
    age: input.age,
    gender: input.gender,
    avatarUrl: input.avatarUrl,
    provider: input.provider ?? "email",
    sports: [],
    createdAt: new Date().toISOString(),
    points: 0,
    joinedMatches: [],
    rewards: [],
  };
  saveUser(user);
  return user;
}

// ----- Rewards -----

export function addPoints(delta: number, reason: string) {
  const u = getUser();
  if (!u) return null;
  u.points = (u.points ?? 0) + delta;
  u.rewards = [{ ts: new Date().toISOString(), delta, reason }, ...(u.rewards ?? [])].slice(0, 50);
  saveUser(u);
  return u;
}

export function tierFromPoints(points: number): { name: string; next?: number; color: string } {
  if (points >= 3000) return { name: "Legend", color: "oklch(0.85 0.16 75)" };
  if (points >= 1500) return { name: "Elite", next: 3000, color: "oklch(0.78 0.14 80)" };
  if (points >= 500) return { name: "Contender", next: 1500, color: "oklch(0.72 0.13 85)" };
  return { name: "Rookie", next: 500, color: "oklch(0.65 0.10 80)" };
}

// ----- Match join/leave -----

export function joinMatch(m: Omit<JoinedMatch, "joinedAt">) {
  const u = getUser();
  if (!u) return null;
  if (u.joinedMatches.some((x) => x.id === m.id)) return u;
  u.joinedMatches = [{ ...m, joinedAt: new Date().toISOString() }, ...u.joinedMatches];
  saveUser(u);
  return addPoints(25, `Joined ${m.sport} match`);
}

export function leaveMatch(id: string) {
  const u = getUser();
  if (!u) return null;
  const m = u.joinedMatches.find((x) => x.id === id);
  if (!m) return u;
  if (!canLeaveMatch(m.scheduledAt)) return u;
  u.joinedMatches = u.joinedMatches.filter((x) => x.id !== id);
  saveUser(u);
  return addPoints(-10, `Left ${m.sport} match`);
}

export function completeMatch(id: string) {
  const u = getUser();
  if (!u) return null;
  const m = u.joinedMatches.find((x) => x.id === id);
  if (!m || m.completed) return u;
  u.joinedMatches = u.joinedMatches.map((x) => (x.id === id ? { ...x, completed: true } : x));
  saveUser(u);
  return addPoints(100, `Completed ${m.sport} match`);
}

export function canLeaveMatch(scheduledAt: string): boolean {
  const t = new Date(scheduledAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() < t - 30 * 60 * 1000;
}

export function isJoined(id: string): boolean {
  const u = getUser();
  return !!u?.joinedMatches.find((x) => x.id === id);
}

// ----- Catalog -----

export const SPORTS: { name: string; emoji: string }[] = [
  { name: "Basketball", emoji: "🏀" },
  { name: "Soccer", emoji: "⚽" },
  { name: "Tennis", emoji: "🎾" },
  { name: "Pickleball", emoji: "🥒" },
  { name: "Cricket", emoji: "🏏" },
  { name: "Volleyball", emoji: "🏐" },
  { name: "Badminton", emoji: "🏸" },
  { name: "Football", emoji: "🏈" },
  { name: "Baseball", emoji: "⚾" },
  { name: "Golf", emoji: "⛳" },
  { name: "Table Tennis", emoji: "🏓" },
  { name: "Running", emoji: "🏃" },
  { name: "Yoga", emoji: "🧘" },
  { name: "Swimming", emoji: "🏊" },
  { name: "Cycling", emoji: "🚴" },
  { name: "Hiking", emoji: "🥾" },
  { name: "Boxing", emoji: "🥊" },
  { name: "Squash", emoji: "🎯" },
  { name: "Rock Climbing", emoji: "🧗" },
  { name: "Skating", emoji: "⛸️" },
];

export const LEVELS: { value: SkillLevel; label: string; desc: string }[] = [
  { value: "Beginner", label: "Beginner", desc: "Learning the fundamentals." },
  { value: "Intermediate", label: "Intermediate", desc: "Comfortable in casual games." },
  { value: "Pro", label: "Pro", desc: "Tournament-level competitor." },
];

export const GENDERS: Gender[] = ["Male", "Female", "Other", "Prefer not to say"];
