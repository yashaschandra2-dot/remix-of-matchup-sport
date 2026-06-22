UPDATE public.user_sports SET level = 'Pro' WHERE level = 'Ace';
ALTER TABLE public.user_sports DROP CONSTRAINT user_sports_level_check;
ALTER TABLE public.user_sports ADD CONSTRAINT user_sports_level_check CHECK (level = ANY (ARRAY['Beginner'::text, 'Intermediate'::text, 'Pro'::text]));