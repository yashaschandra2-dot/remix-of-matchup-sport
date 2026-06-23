import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { joinMatch, leaveMatch, SPORTS } from "@/lib/activv-store";
import { resolveAvatarUrls, initialsFor } from "@/lib/supabase-profile";
import { Crown, MapPin, Clock, Users, LockKeyhole, Loader2, LogOut, UserPlus, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

/** Returns the points penalty (0 or negative) for leaving a match now. */
function leavePenalty(scheduledAt: string): number {
  const minsUntil = (new Date(scheduledAt).getTime() - Date.now()) / 60000;
  if (minsUntil >= 45) return 0;
  if (minsUntil >= 30) return -5;
  if (minsUntil >= 10) return -10;
  if (minsUntil >= 0) return -15;
  return 0;
}

/** Returns the points penalty (0 or negative) for the creator deleting a match now. */
function deletePenalty(scheduledAt: string): number {
  const minsUntil = (new Date(scheduledAt).getTime() - Date.now()) / 60000;
  if (minsUntil > 45) return 0;
  if (minsUntil >= 30) return -5;
  if (minsUntil >= 10) return -10;
  if (minsUntil >= 0) return -15;
  return -15;
}

export interface MatchDetailActivity {
  id: string;
  sport: string;
  title: string;
  location: string;
  date_time: string;
  skill_level: string;
  max_players: number;
  current_players: number;
  creator_id: string;
  description?: string | null;
}

interface ProfileLite {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  signedAvatarUrl?: string | null;
}

export function MatchDetailDialog({
  activity,
  authUserId,
  open,
  onOpenChange,
  onChanged,
}: {
  activity: MatchDetailActivity | null;
  authUserId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const [creator, setCreator] = useState<ProfileLite | null>(null);
  const [participants, setParticipants] = useState<ProfileLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const navigate = useNavigate();

  const isCreator = !!activity && !!authUserId && activity.creator_id === authUserId;
  const isParticipant = useMemo(
    () => !!authUserId && participants.some((p) => p.id === authUserId),
    [participants, authUserId],
  );
  const matchStarted = activity ? Date.now() >= new Date(activity.date_time).getTime() : false;
  const canLeave = !!activity && !matchStarted;
  const penalty = activity ? leavePenalty(activity.date_time) : 0;
  const deletePts = activity && participants.length > 0 ? deletePenalty(activity.date_time) : 0;
  const spotsLeft = activity ? Math.max(0, activity.max_players - activity.current_players) : 0;
  const full = spotsLeft <= 0;
  const emoji = activity ? SPORTS.find((s) => s.name === activity.sport)?.emoji ?? "🏅" : "🏅";

  useEffect(() => {
    if (!open || !activity) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const [{ data: creatorRow }, { data: parts }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .eq("id", activity.creator_id)
          .maybeSingle(),
        supabase
          .from("match_participants" as never)
          .select("user_id, joined_at")
          .eq("activity_id", activity.id)
          .order("joined_at", { ascending: true }),
      ]);

      if (cancelled) return;
      const ids = ((parts ?? []) as { user_id: string }[]).map((p) => p.user_id);
      const { data: profs } =
        ids.length === 0
          ? { data: [] as { id: string; full_name: string | null; avatar_url: string | null }[] }
          : await supabase
              .from("profiles")
              .select("id, full_name, avatar_url")
              .in("id", ids);
      if (cancelled) return;

      // Batch-sign every avatar path we'll need to show.
      const allPaths = [
        (creatorRow as ProfileLite | null)?.avatar_url ?? null,
        ...((profs ?? []).map((p) => p.avatar_url)),
      ];
      const signed = await resolveAvatarUrls(allPaths);
      if (cancelled) return;

      const creatorBase =
        (creatorRow as ProfileLite | null) ??
        { id: activity.creator_id, full_name: null, avatar_url: null };
      setCreator({
        ...creatorBase,
        signedAvatarUrl: creatorBase.avatar_url ? signed[creatorBase.avatar_url] ?? null : null,
      });

      const byId = new Map((profs ?? []).map((p) => [p.id, p as ProfileLite]));
      setParticipants(
        ids.map((id) => {
          const base = byId.get(id) ?? { id, full_name: null, avatar_url: null };
          return {
            ...base,
            signedAvatarUrl: base.avatar_url ? signed[base.avatar_url] ?? null : null,
          };
        }),
      );
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, activity]);

  // Award +25 to a participant once the match has started (real-time check, dedup'd locally).
  useEffect(() => {
    if (!open || !activity || !authUserId || !isParticipant) return;
    const startMs = new Date(activity.date_time).getTime();
    const award = async () => {
      const key = `activv.awarded.${activity.id}.${authUserId}`;
      if (typeof window === "undefined" || window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, "1");
      await supabase.rpc("add_points" as never, { p_delta: 25 } as never);
      toast.success("Match started · +25 pts");
      onChanged();
    };
    if (Date.now() >= startMs) {
      award();
      return;
    }
    const t = setTimeout(award, startMs - Date.now());
    return () => clearTimeout(t);
  }, [open, activity, authUserId, isParticipant, onChanged]);

  if (!activity) return null;

  const when = new Date(activity.date_time).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  async function handleJoin() {
    if (!activity || !authUserId) return;
    if (isCreator) {
      toast.error("You created this match.");
      return;
    }
    setSubmitting(true);
    // Atomic capacity check + increment: the `.lt()` guard ensures we only
    // increment when there's actually a free spot, even under race conditions.
    // If no row comes back, the match was full at the moment we tried.
    const { data: updatedRow, error: updErr } = await supabase
      .from("activities")
      .update({ current_players: activity.current_players + 1 })
      .eq("id", activity.id)
      .lt("current_players", activity.max_players)
      .select("id, current_players, max_players")
      .maybeSingle();
    if (updErr) {
      setSubmitting(false);
      toast.error(updErr.message);
      return;
    }
    if (!updatedRow) {
      setSubmitting(false);
      toast.error("This match is full");
      onChanged();
      return;
    }
    // Spot reserved — now record participation. Roll back the increment if this fails.
    const { error: insertErr } = await supabase
      .from("match_participants" as never)
      .insert({ activity_id: activity.id, user_id: authUserId } as never);
    if (insertErr) {
      await supabase
        .from("activities")
        .update({ current_players: Math.max(0, updatedRow.current_players - 1) })
        .eq("id", activity.id);
      setSubmitting(false);
      toast.error(insertErr.message);
      return;
    }
    joinMatch({
      id: activity.id,
      sport: activity.sport,
      emoji,
      level: activity.skill_level,
      venue: activity.location,
      scheduledAt: activity.date_time,
    });
    // Joining gives 0 points immediately. +25 is awarded at match start time.
    setSubmitting(false);
    toast.success(`Joined ${activity.sport}`);
    onChanged();
    onOpenChange(false);
  }

  async function handleDelete() {
    if (!activity || !isCreator) return;
    setSubmitting(true);
    // Best-effort: explicit removal (FK ON DELETE CASCADE also handles this)
    await supabase.from("match_participants" as never).delete().eq("activity_id", activity.id);
    const { error } = await supabase.from("activities").delete().eq("id", activity.id);
    if (error) {
      setSubmitting(false);
      toast.error(error.message);
      return;
    }
    if (deletePts < 0) {
      await supabase.rpc("add_points" as never, { p_delta: deletePts } as never);
    }
    setSubmitting(false);
    toast.success(deletePts < 0 ? `Match deleted (${deletePts} pts)` : "Match deleted");
    setConfirmDelete(false);
    onChanged();
    onOpenChange(false);
    navigate({ to: "/home" });
  }

  async function handleLeave() {
    if (!activity || !authUserId) return;
    if (!canLeave) {
      toast.error("Match has already started");
      return;
    }
    setSubmitting(true);
    const { error: delErr } = await supabase
      .from("match_participants" as never)
      .delete()
      .eq("activity_id", activity.id)
      .eq("user_id", authUserId);
    if (delErr) {
      setSubmitting(false);
      toast.error(delErr.message);
      return;
    }
    await supabase
      .from("activities")
      .update({ current_players: Math.max(0, activity.current_players - 1) })
      .eq("id", activity.id);
    leaveMatch(activity.id);
    if (penalty < 0) {
      await supabase.rpc("add_points" as never, { p_delta: penalty } as never);
    }
    setSubmitting(false);
    setConfirmLeave(false);
    toast.success(penalty < 0 ? `Left ${activity.sport} (${penalty} pts)` : `Left ${activity.sport}`);
    onChanged();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition -mt-2 -ml-1 mb-2"
        >
          <ArrowLeft className="size-4" /> Back
        </button>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            <span>{emoji}</span> {activity.title}
          </DialogTitle>
          <DialogDescription>
            {activity.sport} · {activity.skill_level}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><MapPin className="size-4 text-primary" /> {activity.location}</div>
          <div className="flex items-center gap-2"><Clock className="size-4 text-primary" /> {when}</div>
          <div className="flex items-center gap-2">
            <Users className="size-4 text-primary" />
            {activity.current_players}/{activity.max_players} players
            {full ? " · Full" : ` · ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`}
          </div>
        </div>

        {activity.description && (
          <p className="text-sm text-foreground/80 border-l-2 border-primary/40 pl-3">
            {activity.description}
          </p>
        )}

        {/* Creator */}
        <div>
          <h4 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Created by</h4>
          <div className="flex items-center gap-3 surface-card rounded-xl p-3">
            <Avatar className="size-10">
              <AvatarImage src={creator?.signedAvatarUrl ?? undefined} alt={creator?.full_name ?? "Match creator"} />
              <AvatarFallback className="bg-primary/15 text-primary font-medium">
                {initialsFor(creator?.full_name) || (creator?.full_name ? creator.full_name.slice(0, 1).toUpperCase() : "P")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate flex items-center gap-1.5">
                <Crown className="size-3.5 text-primary" />
                {isCreator ? "Created by you" : creator?.full_name || "Unknown player"}
              </div>
            </div>
          </div>
        </div>

        {/* Participants */}
        <div>
          <h4 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Players joined ({participants.length})
          </h4>
          {loading ? (
            <div className="flex items-center text-muted-foreground text-sm gap-2">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : participants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No one has joined yet.</p>
          ) : (
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {participants.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-xl p-2 hover:bg-accent/40">
                  <Avatar className="size-8">
                    <AvatarImage src={p.signedAvatarUrl ?? undefined} alt={p.full_name ?? "Player"} />
                    <AvatarFallback className="bg-primary/15 text-primary text-xs font-medium">
                      {initialsFor(p.full_name) || "P"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium truncate">
                    {p.id === authUserId ? "You" : p.full_name || "Player"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Actions */}
        <div className="pt-2">
          {isCreator ? (
            <div className="space-y-2">
              <div className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-medium text-primary text-center">
                <Crown className="inline size-3.5 mr-1.5" /> You created this match
              </div>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => setConfirmDelete(true)}
                disabled={submitting}
              >
                <Trash2 className="size-4" /> {deletePts < 0 ? `Delete match (${deletePts} pts)` : "Delete match"}
              </Button>
            </div>
          ) : isParticipant ? (
            <Button
              variant="secondary"
              className="w-full"
              disabled={!canLeave || submitting}
              onClick={() => (penalty < 0 ? setConfirmLeave(true) : handleLeave())}
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : !canLeave ? (
                <><LockKeyhole className="size-4" /> Match started</>
              ) : penalty < 0 ? (
                <><LogOut className="size-4" /> Leave match ({penalty} pts)</>
              ) : (
                <><LogOut className="size-4" /> Leave match</>
              )}
            </Button>
          ) : full ? (
            <Button variant="secondary" className="w-full" disabled>
              <LockKeyhole className="size-4" /> Match full
            </Button>
          ) : matchStarted ? (
            <Button variant="secondary" className="w-full" disabled>
              <LockKeyhole className="size-4" /> Match started
            </Button>
          ) : (
            <Button className="w-full" onClick={handleJoin} disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <><UserPlus className="size-4" /> Join match</>}
            </Button>
          )}
        </div>
      </DialogContent>

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this match?</AlertDialogTitle>
            <AlertDialogDescription>
              You will lose {Math.abs(penalty)} Activv points if you leave.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleLeave();
              }}
              disabled={submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : `Leave (${penalty} pts)`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this match?</AlertDialogTitle>
            <AlertDialogDescription>
              {participants.length > 0
                ? deletePts < 0
                  ? `Are you sure you want to delete this match? ${participants.length} player${participants.length === 1 ? "" : "s"} will be removed. You will lose ${Math.abs(deletePts)} Activv points.`
                  : `Are you sure? ${participants.length} player${participants.length === 1 ? "" : "s"} will be removed`
                : "Are you sure you want to delete this match?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : deletePts < 0 ? `Delete (${deletePts} pts)` : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
