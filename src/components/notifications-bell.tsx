import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellRing, UserPlus, UserMinus, Trophy, XCircle, BellOff } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchNotifications,
  markAllAsRead,
  timeAgo,
  type NotificationRow,
} from "@/lib/notifications";

function iconFor(type: string) {
  switch (type) {
    case "match_reminder":
      return { Icon: BellRing, color: "text-primary" };
    case "someone_joined":
      return { Icon: UserPlus, color: "text-green-500" };
    case "someone_left":
      return { Icon: UserMinus, color: "text-orange-500" };
    case "points_earned":
      return { Icon: Trophy, color: "text-yellow-500" };
    case "match_cancelled":
      return { Icon: XCircle, color: "text-destructive" };
    default:
      return { Icon: Bell, color: "text-muted-foreground" };
  }
}

export function NotificationsBell() {
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);
  const pollRef = useRef<number | null>(null);

  const load = useCallback(async (uid: string) => {
    try {
      const rows = await fetchNotifications(uid);
      setItems(rows);
    } catch (err) {
      console.warn("[notifications] load failed", err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled || !data.user) return;
      setUserId(data.user.id);
      await load(data.user.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    // light polling for new notifications
    pollRef.current = window.setInterval(() => {
      void load(userId);
    }, 30_000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [userId, load]);

  const unread = items.filter((n) => !n.is_read).length;

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && userId && unread > 0) {
      await markAllAsRead(userId);
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
          className="relative grid place-items-center size-10 rounded-full text-foreground hover:bg-accent/40 transition"
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-destructive ring-2 ring-background" />
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b border-border">
          <SheetTitle className="font-display text-xl">Notifications</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center text-muted-foreground">
              <BellOff className="size-10 mb-3 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const { Icon, color } = iconFor(n.type);
                return (
                  <li
                    key={n.id}
                    className={`flex items-start gap-3 px-5 py-4 ${
                      n.is_read ? "" : "bg-primary/5"
                    }`}
                  >
                    <div className={`mt-0.5 grid place-items-center size-9 rounded-full bg-accent/40 ${color}`}>
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground leading-snug">{n.message}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{timeAgo(n.created_at)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}