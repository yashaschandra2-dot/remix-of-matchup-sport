CREATE OR REPLACE FUNCTION public.add_points(p_delta integer)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  UPDATE public.profiles
  SET points = points + p_delta,
      updated_at = now()
  WHERE id = auth.uid()
  RETURNING points;
$function$;