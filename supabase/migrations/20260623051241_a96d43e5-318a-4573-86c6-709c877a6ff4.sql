ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
ALTER TABLE public.activities REPLICA IDENTITY FULL;