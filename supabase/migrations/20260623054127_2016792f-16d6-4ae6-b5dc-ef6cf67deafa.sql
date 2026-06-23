DROP FUNCTION IF EXISTS public.join_activity(uuid);
DROP FUNCTION IF EXISTS public.leave_activity(uuid);

CREATE OR REPLACE FUNCTION public.join_activity(p_activity_id uuid)
RETURNS TABLE(v_current_players int, v_max_players int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_creator uuid;
  v_cur int;
  v_max int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT a.creator_id, a.current_players, a.max_players
    INTO v_creator, v_cur, v_max
  FROM public.activities a
  WHERE a.id = p_activity_id
  FOR UPDATE;

  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'Match not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_creator = v_uid THEN
    RAISE EXCEPTION 'You created this match' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.match_participants mp
             WHERE mp.activity_id = p_activity_id AND mp.user_id = v_uid) THEN
    RAISE EXCEPTION 'Already joined' USING ERRCODE = 'P0001';
  END IF;
  IF v_cur >= v_max THEN
    RAISE EXCEPTION 'This match is full' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.match_participants(activity_id, user_id)
  VALUES (p_activity_id, v_uid);

  UPDATE public.activities a
     SET current_players = a.current_players + 1,
         updated_at = now()
   WHERE a.id = p_activity_id
  RETURNING a.current_players, a.max_players
    INTO v_cur, v_max;

  v_current_players := v_cur;
  v_max_players := v_max;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_activity(p_activity_id uuid)
RETURNS TABLE(v_current_players int, v_max_players int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_deleted int;
  v_cur int;
  v_max int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  PERFORM 1 FROM public.activities WHERE id = p_activity_id FOR UPDATE;

  DELETE FROM public.match_participants
   WHERE activity_id = p_activity_id AND user_id = v_uid;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted > 0 THEN
    UPDATE public.activities a
       SET current_players = GREATEST(0, a.current_players - 1),
           updated_at = now()
     WHERE a.id = p_activity_id
    RETURNING a.current_players, a.max_players
      INTO v_cur, v_max;
  ELSE
    SELECT a.current_players, a.max_players INTO v_cur, v_max
      FROM public.activities a WHERE a.id = p_activity_id;
  END IF;

  v_current_players := v_cur;
  v_max_players := v_max;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_activity(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_activity(uuid) TO authenticated;