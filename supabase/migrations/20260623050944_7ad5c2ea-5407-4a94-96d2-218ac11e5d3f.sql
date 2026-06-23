-- Additive columns on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS skill_level text,
  ADD COLUMN IF NOT EXISTS activv_points integer NOT NULL DEFAULT 0;

-- Additive column on user_sports (keeps existing `level` for backwards compat)
ALTER TABLE public.user_sports
  ADD COLUMN IF NOT EXISTS skill_level text;

-- Additive column on activities
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS is_group boolean NOT NULL DEFAULT false;

-- Ensure auth signup trigger exists and is wired to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();