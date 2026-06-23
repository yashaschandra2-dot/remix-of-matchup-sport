
-- ============== TABLES ==============

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  message text NOT NULL,
  match_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_select_own ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY notifications_insert_authenticated ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY notifications_delete_own ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX notifications_user_created_idx ON public.notifications (user_id, created_at DESC);

CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY,
  notifications_enabled boolean NOT NULL DEFAULT true,
  match_reminder boolean NOT NULL DEFAULT true,
  someone_joined boolean NOT NULL DEFAULT true,
  someone_left boolean NOT NULL DEFAULT true,
  match_cancelled boolean NOT NULL DEFAULT true,
  points_earned boolean NOT NULL DEFAULT true,
  in_app_enabled boolean NOT NULL DEFAULT true,
  push_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_preferences_select_own ON public.notification_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY notification_preferences_insert_own ON public.notification_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY notification_preferences_update_own ON public.notification_preferences FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY notification_preferences_delete_own ON public.notification_preferences FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL,
  platform text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;
GRANT ALL ON public.push_tokens TO service_role;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY push_tokens_select_own ON public.push_tokens FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY push_tokens_insert_own ON public.push_tokens FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY push_tokens_delete_own ON public.push_tokens FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Track which matches have had reminders sent so the cron doesn't double-send
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

-- ============== HELPER: insert notification respecting preferences ==============

CREATE OR REPLACE FUNCTION public.insert_notification(
  p_user_id uuid,
  p_type text,
  p_message text,
  p_match_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefs public.notification_preferences%ROWTYPE;
  type_allowed boolean := true;
BEGIN
  SELECT * INTO prefs FROM public.notification_preferences WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    -- defaults: all on
    INSERT INTO public.notifications(user_id, type, message, match_id) VALUES (p_user_id, p_type, p_message, p_match_id);
    RETURN;
  END IF;
  IF NOT prefs.notifications_enabled THEN RETURN; END IF;
  IF NOT prefs.in_app_enabled THEN RETURN; END IF;
  type_allowed := CASE p_type
    WHEN 'match_reminder' THEN prefs.match_reminder
    WHEN 'someone_joined' THEN prefs.someone_joined
    WHEN 'someone_left' THEN prefs.someone_left
    WHEN 'match_cancelled' THEN prefs.match_cancelled
    WHEN 'points_earned' THEN prefs.points_earned
    ELSE true
  END;
  IF NOT type_allowed THEN RETURN; END IF;
  INSERT INTO public.notifications(user_id, type, message, match_id) VALUES (p_user_id, p_type, p_message, p_match_id);
END;
$$;

-- ============== TRIGGERS ==============

-- Someone joined
CREATE OR REPLACE FUNCTION public.notify_someone_joined()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_creator uuid;
  v_title text;
  v_name text;
BEGIN
  SELECT creator_id, title INTO v_creator, v_title FROM public.activities WHERE id = NEW.activity_id;
  IF v_creator IS NULL OR v_creator = NEW.user_id THEN RETURN NEW; END IF;
  SELECT COALESCE(NULLIF(full_name, ''), 'A player') INTO v_name FROM public.profiles WHERE id = NEW.user_id;
  PERFORM public.insert_notification(v_creator, 'someone_joined', COALESCE(v_name,'A player') || ' joined your match ' || v_title, NEW.activity_id);
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS trg_notify_someone_joined ON public.match_participants;
CREATE TRIGGER trg_notify_someone_joined AFTER INSERT ON public.match_participants
FOR EACH ROW EXECUTE FUNCTION public.notify_someone_joined();

-- Someone left
CREATE OR REPLACE FUNCTION public.notify_someone_left()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_creator uuid;
  v_title text;
  v_name text;
BEGIN
  SELECT creator_id, title INTO v_creator, v_title FROM public.activities WHERE id = OLD.activity_id;
  IF v_creator IS NULL OR v_creator = OLD.user_id THEN RETURN OLD; END IF;
  SELECT COALESCE(NULLIF(full_name, ''), 'A player') INTO v_name FROM public.profiles WHERE id = OLD.user_id;
  PERFORM public.insert_notification(v_creator, 'someone_left', COALESCE(v_name,'A player') || ' left your match ' || v_title, OLD.activity_id);
  RETURN OLD;
END;$$;
DROP TRIGGER IF EXISTS trg_notify_someone_left ON public.match_participants;
CREATE TRIGGER trg_notify_someone_left AFTER DELETE ON public.match_participants
FOR EACH ROW EXECUTE FUNCTION public.notify_someone_left();

-- Match cancelled (notify all participants before cascade delete removes them)
CREATE OR REPLACE FUNCTION public.notify_match_cancelled()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  v_when text;
BEGIN
  v_when := to_char(OLD.date_time AT TIME ZONE 'UTC', 'Mon DD');
  FOR r IN SELECT user_id FROM public.match_participants WHERE activity_id = OLD.id LOOP
    IF r.user_id <> OLD.creator_id THEN
      PERFORM public.insert_notification(r.user_id, 'match_cancelled',
        'Match ' || OLD.title || ' on ' || v_when || ' has been cancelled by the creator', OLD.id);
    END IF;
  END LOOP;
  RETURN OLD;
END;$$;
DROP TRIGGER IF EXISTS trg_notify_match_cancelled ON public.activities;
CREATE TRIGGER trg_notify_match_cancelled BEFORE DELETE ON public.activities
FOR EACH ROW EXECUTE FUNCTION public.notify_match_cancelled();

-- ============== add_points: also emit "points earned" notification on positive delta ==============

CREATE OR REPLACE FUNCTION public.add_points(p_delta integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new int;
BEGIN
  UPDATE public.profiles
     SET points = points + p_delta,
         updated_at = now()
   WHERE id = auth.uid()
  RETURNING points INTO v_new;
  IF p_delta > 0 THEN
    PERFORM public.insert_notification(
      auth.uid(),
      'points_earned',
      'You earned +' || p_delta || ' Activv Points!',
      NULL
    );
  END IF;
  RETURN v_new;
END;
$$;

-- Optional richer variant: include match title
CREATE OR REPLACE FUNCTION public.award_match_points(p_match_id uuid, p_delta integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new int;
  v_title text;
BEGIN
  UPDATE public.profiles
     SET points = points + p_delta,
         updated_at = now()
   WHERE id = auth.uid()
  RETURNING points INTO v_new;
  SELECT title INTO v_title FROM public.activities WHERE id = p_match_id;
  IF p_delta > 0 THEN
    PERFORM public.insert_notification(
      auth.uid(),
      'points_earned',
      'You earned +' || p_delta || ' Activv Points for completing ' || COALESCE(v_title, 'your match') || '!',
      p_match_id
    );
  END IF;
  RETURN v_new;
END;
$$;

-- ============== CRON: match reminder ~1h before ==============

CREATE OR REPLACE FUNCTION public.send_match_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a record;
  p record;
  v_when text;
  v_count int := 0;
BEGIN
  FOR a IN
    SELECT id, title, location, date_time, creator_id
      FROM public.activities
     WHERE date_time BETWEEN now() + interval '55 minutes' AND now() + interval '65 minutes'
       AND reminder_sent_at IS NULL
  LOOP
    v_when := to_char(a.date_time, 'HH24:MI');
    -- creator
    PERFORM public.insert_notification(a.creator_id, 'match_reminder',
      'Your match ' || a.title || ' starts in 1 hour at ' || a.location || '. Get ready!', a.id);
    -- participants
    FOR p IN SELECT user_id FROM public.match_participants WHERE activity_id = a.id LOOP
      PERFORM public.insert_notification(p.user_id, 'match_reminder',
        'Your match ' || a.title || ' starts in 1 hour at ' || a.location || '. Get ready!', a.id);
    END LOOP;
    UPDATE public.activities SET reminder_sent_at = now() WHERE id = a.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('match-reminders-5min');
EXCEPTION WHEN OTHERS THEN NULL;
END$$;

SELECT cron.schedule(
  'match-reminders-5min',
  '*/5 * * * *',
  $cron$SELECT public.send_match_reminders();$cron$
);
