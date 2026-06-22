
-- Allow any authenticated user to view profiles (so we can display creator and participant names/photos)
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_authenticated ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- Match participants table
CREATE TABLE public.match_participants (
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (activity_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.match_participants TO authenticated;
GRANT ALL ON public.match_participants TO service_role;

ALTER TABLE public.match_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY match_participants_select_all ON public.match_participants
  FOR SELECT TO authenticated USING (true);

CREATE POLICY match_participants_insert_own ON public.match_participants
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY match_participants_delete_own ON public.match_participants
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX match_participants_activity_idx ON public.match_participants(activity_id);
CREATE INDEX match_participants_user_idx ON public.match_participants(user_id);
