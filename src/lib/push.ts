import { supabase } from "@/integrations/supabase/client";

/**
 * Push notification scaffold. Requests browser permission and stores a
 * device token in push_tokens. Real Web Push delivery (edge function +
 * VAPID signing) can be wired later without changes to call sites.
 *
 * If the user denies permission, in-app notifications continue to work.
 */
export async function requestPushPermissionAndRegister(userId: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  const KEY = `activv.push.asked.${userId}`;
  if (window.localStorage.getItem(KEY)) return;
  try {
    const result = await Notification.requestPermission();
    window.localStorage.setItem(KEY, "1");
    if (result !== "granted") return;

    // Best-effort: persist a token. On web without a service worker /
    // VAPID, we store a stable browser-instance token so the table is
    // populated; a real Web Push or APNs/FCM token replaces this later.
    let token = window.localStorage.getItem("activv.push.token");
    if (!token) {
      token = `web-${crypto.randomUUID()}`;
      window.localStorage.setItem("activv.push.token", token);
    }
    const platform = /iPhone|iPad|iPod/i.test(navigator.userAgent)
      ? "ios-web"
      : /Android/i.test(navigator.userAgent)
        ? "android-web"
        : "web";
    await supabase
      .from("push_tokens" as never)
      .upsert(
        { user_id: userId, token, platform } as never,
        { onConflict: "user_id,token" } as never,
      );
  } catch (err) {
    console.warn("[push] registration skipped", err);
  }
}