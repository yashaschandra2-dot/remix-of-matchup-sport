import { supabase } from "@/integrations/supabase/client";
import { saveUser, signOut as clearLocal, type ActivvUser, type Gender, type SkillLevel } from "@/lib/activv-store";

export type ProfileRow = {
  id: string;
  full_name: string | null;
  completed: boolean;
  city: string | null;
  bio: string | null;
  age: number | null;
  gender: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type UserSportRow = { sport: string; level: SkillLevel };

export async function fetchProfileBundle(userId: string) {
  const [{ data: profile, error: pErr }, { data: sports, error: sErr }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("user_sports").select("sport, level").eq("user_id", userId),
  ]);
  if (pErr) throw pErr;
  if (sErr) throw sErr;
  return {
    profile: profile as ProfileRow | null,
    sports: ((sports ?? []) as UserSportRow[]),
  };
}

export function hasCompletedOnboarding(profile: ProfileRow | null, sports: UserSportRow[]) {
  return (
    profile?.completed === true ||
    (profile?.full_name != null && profile.full_name.trim().length > 0) ||
    sports.length > 0
  );
}

/** Resolves a signed URL for an avatar stored in the private `avatars` bucket. */
export async function resolveAvatarUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  const { data, error } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  const { error: updErr } = await supabase
    .from("profiles")
    .update({ avatar_url: path, photo_url: path })
    .eq("id", userId);
  if (updErr) throw updErr;
  return path;
}

/**
 * Batch-sign a list of storage paths (or pass-through full URLs) from the
 * private `avatars` bucket. Returns a map keyed by the original input value.
 */
export async function resolveAvatarUrls(
  paths: (string | null | undefined)[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const toSign: string[] = [];
  for (const p of paths) {
    if (!p) continue;
    if (/^https?:\/\//.test(p)) {
      out[p] = p;
    } else if (!(p in out) && !toSign.includes(p)) {
      toSign.push(p);
    }
  }
  if (toSign.length === 0) return out;
  const { data, error } = await supabase.storage
    .from("avatars")
    .createSignedUrls(toSign, 60 * 60);
  if (error || !data) return out;
  for (const item of data) {
    if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  }
  return out;
}

/** Initials helper — never returns "?"; falls back to a person glyph upstream. */
export function initialsFor(name: string | null | undefined, email?: string | null): string {
  const src = (name ?? "").trim() || (email ?? "").trim();
  if (!src) return "";
  return src
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Mirrors the Supabase profile + sports into the local activv-store cache used by Home/Matches. */
export async function hydrateLocalFromSupabase(userId: string, email: string) {
  const { profile, sports } = await fetchProfileBundle(userId);
  const avatarUrl = await resolveAvatarUrl(profile?.avatar_url);
  const cached: ActivvUser = {
    id: userId,
    email,
    name: profile?.full_name || email.split("@")[0],
    city: profile?.city ?? undefined,
    bio: profile?.bio ?? undefined,
    age: profile?.age ?? undefined,
    gender: (profile?.gender as Gender | undefined) ?? undefined,
    avatarUrl: avatarUrl ?? undefined,
    provider: "email",
    sports: sports.map((s) => ({ sport: s.sport, level: s.level })),
    createdAt: profile?.created_at ?? new Date().toISOString(),
    points: 100,
    joinedMatches: [],
    rewards: [],
  };
  // Preserve any local-only points/matches from prior session
  try {
    const raw = window.localStorage.getItem("activv.user");
    if (raw) {
      const prev = JSON.parse(raw) as ActivvUser;
      if (prev.id === userId) {
        cached.points = prev.points ?? cached.points;
        cached.joinedMatches = prev.joinedMatches ?? [];
        cached.rewards = prev.rewards ?? [];
      }
    }
  } catch {}
  saveUser(cached);
  return { profile, sports, avatarUrl };
}

export async function signOutEverywhere() {
  await supabase.auth.signOut();
  clearLocal();
}

export async function replaceUserSports(userId: string, picks: { sport: string; level: SkillLevel }[]) {
  // Delete then insert — simple replace
  const { error: delErr } = await supabase.from("user_sports").delete().eq("user_id", userId);
  if (delErr) throw delErr;
  if (picks.length === 0) return;
  const { error: insErr } = await supabase
    .from("user_sports")
    .insert(picks.map((p) => ({ user_id: userId, sport: p.sport, level: p.level })));
  if (insErr) throw insErr;
}
