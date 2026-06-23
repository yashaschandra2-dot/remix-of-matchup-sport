import { supabase } from "@/integrations/supabase/client";

export type NotificationType =
  | "match_reminder"
  | "someone_joined"
  | "someone_left"
  | "match_cancelled"
  | "points_earned";

export interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType | string;
  message: string;
  match_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationPreferences {
  user_id: string;
  notifications_enabled: boolean;
  match_reminder: boolean;
  someone_joined: boolean;
  someone_left: boolean;
  match_cancelled: boolean;
  points_earned: boolean;
  in_app_enabled: boolean;
  push_enabled: boolean;
}

export const DEFAULT_PREFERENCES: Omit<NotificationPreferences, "user_id"> = {
  notifications_enabled: true,
  match_reminder: true,
  someone_joined: true,
  someone_left: true,
  match_cancelled: true,
  points_earned: true,
  in_app_enabled: true,
  push_enabled: true,
};

export async function fetchNotifications(userId: string): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications" as never)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}

export async function markAllAsRead(userId: string): Promise<void> {
  await supabase
    .from("notifications" as never)
    .update({ is_read: true } as never)
    .eq("user_id", userId)
    .eq("is_read", false);
}

export async function fetchPreferences(userId: string): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from("notification_preferences" as never)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { user_id: userId, ...DEFAULT_PREFERENCES };
  return data as NotificationPreferences;
}

export async function savePreferences(prefs: NotificationPreferences): Promise<void> {
  const { error } = await supabase
    .from("notification_preferences" as never)
    .upsert(prefs as never, { onConflict: "user_id" } as never);
  if (error) throw error;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}