ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false;

UPDATE public.profiles p
SET completed = true
WHERE p.full_name IS NOT NULL
  AND p.full_name <> ''
  AND EXISTS (SELECT 1 FROM public.user_sports us WHERE us.user_id = p.id);