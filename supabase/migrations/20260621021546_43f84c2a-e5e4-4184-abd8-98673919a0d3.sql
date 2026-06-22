
CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sport text NOT NULL,
  title text NOT NULL,
  location text NOT NULL,
  date_time timestamptz NOT NULL,
  skill_level text NOT NULL,
  max_players integer NOT NULL CHECK (max_players > 0),
  current_players integer NOT NULL DEFAULT 1 CHECK (current_players >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activities TO authenticated;
GRANT ALL ON public.activities TO service_role;

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY activities_select_all ON public.activities
  FOR SELECT TO authenticated USING (true);

CREATE POLICY activities_insert_own ON public.activities
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);

CREATE POLICY activities_update_own ON public.activities
  FOR UPDATE TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);

CREATE POLICY activities_delete_own ON public.activities
  FOR DELETE TO authenticated USING (auth.uid() = creator_id);

CREATE TRIGGER activities_set_updated_at
  BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX activities_date_time_idx ON public.activities (date_time ASC);
