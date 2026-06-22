ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS play_mode text NOT NULL DEFAULT 'Solo',
  ADD COLUMN IF NOT EXISTS group_size integer;