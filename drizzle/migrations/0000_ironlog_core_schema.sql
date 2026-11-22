
-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  display_name text,
  avatar_url text,
  bio text,
  unit text NOT NULL DEFAULT 'kg' CHECK (unit IN ('kg','lb')),
  bodyweight numeric(6,2),
  default_rest_seconds int NOT NULL DEFAULT 90 CHECK (default_rest_seconds BETWEEN 0 AND 900),
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT username_format CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,24}$')
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own profile readable" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Public profiles readable" ON public.profiles FOR SELECT TO anon, authenticated USING (is_public = true);
CREATE POLICY "Insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ SUBSCRIPTIONS ============
CREATE TABLE public.subscription_plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  tier text NOT NULL CHECK (tier IN ('free','premium')),
  billing_interval text CHECK (billing_interval IN ('month','year')),
  price_minor int NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_plans TO anon, authenticated;
GRANT ALL ON public.subscription_plans TO service_role;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plans are public" ON public.subscription_plans FOR SELECT TO anon, authenticated USING (is_active = true);

INSERT INTO public.subscription_plans (id, name, tier, billing_interval, price_minor, currency, sort_order) VALUES
  ('free', 'Free', 'free', NULL, 0, 'INR', 0),
  ('premium_monthly', 'Premium Monthly', 'premium', 'month', 29900, 'INR', 1),
  ('premium_annual', 'Premium Annual', 'premium', 'year', 249900, 'INR', 2);

CREATE TABLE public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  plan_id text NOT NULL REFERENCES public.subscription_plans(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','trialing','past_due','canceled','expired')),
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_subscriptions TO authenticated;
GRANT ALL ON public.user_subscriptions TO service_role;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own subscription readable" ON public.user_subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER user_subscriptions_touch BEFORE UPDATE ON public.user_subscriptions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.is_premium(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_subscriptions us
    JOIN public.subscription_plans p ON p.id = us.plan_id
    WHERE us.user_id = _user_id AND p.tier = 'premium'
      AND us.status IN ('active','trialing')
      AND (us.current_period_end IS NULL OR us.current_period_end > now())
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_premium(uuid) TO authenticated;

-- ============ EXERCISES ============
CREATE TABLE public.exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  category text NOT NULL CHECK (category IN ('chest','back','shoulders','biceps','triceps','quadriceps','hamstrings','glutes','calves','abs')),
  primary_muscle text NOT NULL,
  secondary_muscles text[] NOT NULL DEFAULT '{}',
  equipment text NOT NULL DEFAULT 'bodyweight',
  instructions text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX exercises_user_idx ON public.exercises(user_id);
CREATE INDEX exercises_category_idx ON public.exercises(category);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercises TO authenticated;
GRANT ALL ON public.exercises TO service_role;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read built-in and own exercises" ON public.exercises FOR SELECT TO authenticated USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "Create own exercises" ON public.exercises FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update own exercises" ON public.exercises FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Delete own exercises" ON public.exercises FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============ ROUTINES ============
CREATE TABLE public.routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX routines_user_idx ON public.routines(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routines TO authenticated;
GRANT ALL ON public.routines TO service_role;
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own routines" ON public.routines FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER routines_touch BEFORE UPDATE ON public.routines FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_routine_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_premium(NEW.user_id)
     AND (SELECT count(*) FROM public.routines WHERE user_id = NEW.user_id) >= 3 THEN
    RAISE EXCEPTION 'Free plan allows up to 3 routines. Upgrade to Premium for unlimited routines.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER routines_limit BEFORE INSERT ON public.routines FOR EACH ROW EXECUTE FUNCTION public.enforce_routine_limit();

CREATE TABLE public.routine_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id uuid NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  position int NOT NULL DEFAULT 0,
  weekday smallint CHECK (weekday BETWEEN 0 AND 6),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX routine_days_routine_idx ON public.routine_days(routine_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routine_days TO authenticated;
GRANT ALL ON public.routine_days TO service_role;
ALTER TABLE public.routine_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own routine days" ON public.routine_days FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.routine_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_day_id uuid NOT NULL REFERENCES public.routine_days(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  target_sets int NOT NULL DEFAULT 3 CHECK (target_sets BETWEEN 1 AND 20),
  target_reps text NOT NULL DEFAULT '8-12',
  rest_seconds int NOT NULL DEFAULT 90,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX routine_exercises_day_idx ON public.routine_exercises(routine_day_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routine_exercises TO authenticated;
GRANT ALL ON public.routine_exercises TO service_role;
ALTER TABLE public.routine_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own routine exercises" ON public.routine_exercises FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ WORKOUTS ============
CREATE TABLE public.workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL DEFAULT 'Workout',
  notes text,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  routine_id uuid REFERENCES public.routines(id) ON DELETE SET NULL,
  routine_day_id uuid REFERENCES public.routine_days(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds int,
  total_volume numeric(12,2) NOT NULL DEFAULT 0,
  total_sets int NOT NULL DEFAULT 0,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workout_sessions_user_started_idx ON public.workout_sessions(user_id, started_at DESC);
CREATE UNIQUE INDEX one_active_workout_per_user ON public.workout_sessions(user_id) WHERE status = 'in_progress';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_sessions TO authenticated;
GRANT ALL ON public.workout_sessions TO service_role;
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own sessions" ON public.workout_sessions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER workout_sessions_touch BEFORE UPDATE ON public.workout_sessions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.workout_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  notes text,
  rest_seconds int NOT NULL DEFAULT 90,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workout_exercises_session_idx ON public.workout_exercises(session_id);
CREATE INDEX workout_exercises_exercise_idx ON public.workout_exercises(user_id, exercise_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_exercises TO authenticated;
GRANT ALL ON public.workout_exercises TO service_role;
ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own workout exercises" ON public.workout_exercises FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.workout_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_exercise_id uuid NOT NULL REFERENCES public.workout_exercises(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  set_number int NOT NULL DEFAULT 1,
  weight numeric(7,2) CHECK (weight IS NULL OR weight >= 0),
  reps int CHECK (reps IS NULL OR reps >= 0),
  completed boolean NOT NULL DEFAULT false,
  set_type text NOT NULL DEFAULT 'normal' CHECK (set_type IN ('normal','warmup','drop','failure')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workout_sets_we_idx ON public.workout_sets(workout_exercise_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_sets TO authenticated;
GRANT ALL ON public.workout_sets TO service_role;
ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own sets" ON public.workout_sets FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ PERSONAL RECORDS ============
CREATE TABLE public.personal_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  record_type text NOT NULL CHECK (record_type IN ('max_weight','max_reps','est_1rm','max_volume')),
  value numeric(12,2) NOT NULL,
  weight numeric(7,2),
  reps int,
  session_id uuid REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  achieved_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX personal_records_user_idx ON public.personal_records(user_id, achieved_at DESC);
CREATE INDEX personal_records_exercise_idx ON public.personal_records(user_id, exercise_id, record_type);
GRANT SELECT ON public.personal_records TO authenticated;
GRANT ALL ON public.personal_records TO service_role;
ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own records readable" ON public.personal_records FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============ SOCIAL (future) ============
CREATE TABLE public.follows (
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See own follow edges" ON public.follows FOR SELECT TO authenticated USING (follower_id = auth.uid() OR following_id = auth.uid());
CREATE POLICY "Follow as self" ON public.follows FOR INSERT TO authenticated WITH CHECK (follower_id = auth.uid());
CREATE POLICY "Unfollow as self" ON public.follows FOR DELETE TO authenticated USING (follower_id = auth.uid());

-- ============ FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.est_1rm(_weight numeric, _reps int)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN _weight IS NULL OR _reps IS NULL OR _reps <= 0 THEN NULL
              WHEN _reps = 1 THEN _weight
              ELSE round(_weight * (1 + _reps / 30.0), 2) END
$$;

-- Atomic save of an in-progress or edited workout
CREATE OR REPLACE FUNCTION public.save_workout(_session_id uuid, _payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  ex jsonb; st jsonb;
  ex_ids uuid[] := '{}';
  set_ids uuid[] := '{}';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM workout_sessions WHERE id = _session_id AND user_id = _uid) THEN
    RAISE EXCEPTION 'Workout not found';
  END IF;

  UPDATE workout_sessions SET
    name = COALESCE(NULLIF(trim(_payload->>'name'), ''), name),
    notes = _payload->>'notes'
  WHERE id = _session_id;

  FOR ex IN SELECT * FROM jsonb_array_elements(COALESCE(_payload->'exercises', '[]'::jsonb)) LOOP
    ex_ids := ex_ids || (ex->>'id')::uuid;
    INSERT INTO workout_exercises (id, session_id, user_id, exercise_id, position, notes, rest_seconds)
    VALUES ((ex->>'id')::uuid, _session_id, _uid, (ex->>'exercise_id')::uuid,
            COALESCE((ex->>'position')::int, 0), ex->>'notes', COALESCE((ex->>'rest_seconds')::int, 90))
    ON CONFLICT (id) DO UPDATE SET
      exercise_id = EXCLUDED.exercise_id, position = EXCLUDED.position,
      notes = EXCLUDED.notes, rest_seconds = EXCLUDED.rest_seconds;

    FOR st IN SELECT * FROM jsonb_array_elements(COALESCE(ex->'sets', '[]'::jsonb)) LOOP
      set_ids := set_ids || (st->>'id')::uuid;
      INSERT INTO workout_sets (id, workout_exercise_id, user_id, set_number, weight, reps, completed, set_type)
      VALUES ((st->>'id')::uuid, (ex->>'id')::uuid, _uid,
              COALESCE((st->>'set_number')::int, 1),
              NULLIF(st->>'weight', '')::numeric,
              NULLIF(st->>'reps', '')::int,
              COALESCE((st->>'completed')::boolean, false),
              COALESCE(st->>'set_type', 'normal'))
      ON CONFLICT (id) DO UPDATE SET
        workout_exercise_id = EXCLUDED.workout_exercise_id, set_number = EXCLUDED.set_number,
        weight = EXCLUDED.weight, reps = EXCLUDED.reps,
        completed = EXCLUDED.completed, set_type = EXCLUDED.set_type;
    END LOOP;
  END LOOP;

  DELETE FROM workout_sets s USING workout_exercises we
   WHERE s.workout_exercise_id = we.id AND we.session_id = _session_id AND NOT (s.id = ANY(set_ids));
  DELETE FROM workout_exercises WHERE session_id = _session_id AND NOT (id = ANY(ex_ids));
END $$;
GRANT EXECUTE ON FUNCTION public.save_workout(uuid, jsonb) TO authenticated;

-- Rebuild PR history for one exercise (for the calling user)
CREATE OR REPLACE FUNCTION public.recompute_personal_records(_exercise_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  r record;
  best_w numeric := 0; best_r int := 0; best_e numeric := 0; best_v numeric := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  DELETE FROM personal_records WHERE user_id = _uid AND exercise_id = _exercise_id;

  FOR r IN
    SELECT ws.id AS session_id, ws.started_at,
           s.weight, s.reps, public.est_1rm(s.weight, s.reps) AS e1rm,
           SUM(COALESCE(s.weight,0) * COALESCE(s.reps,0)) OVER (PARTITION BY ws.id) AS sess_volume,
           ROW_NUMBER() OVER (PARTITION BY ws.id ORDER BY s.set_number) AS rn,
           COUNT(*) OVER (PARTITION BY ws.id) AS cnt
    FROM workout_sets s
    JOIN workout_exercises we ON we.id = s.workout_exercise_id
    JOIN workout_sessions ws ON ws.id = we.session_id
    WHERE ws.user_id = _uid AND ws.status = 'completed' AND we.exercise_id = _exercise_id
      AND s.completed AND s.set_type <> 'warmup' AND s.reps IS NOT NULL AND s.reps > 0
    ORDER BY ws.started_at, ws.id, s.set_number
  LOOP
    IF r.weight IS NOT NULL AND r.weight > best_w THEN
      best_w := r.weight;
      INSERT INTO personal_records (user_id, exercise_id, record_type, value, weight, reps, session_id, achieved_at)
      VALUES (_uid, _exercise_id, 'max_weight', r.weight, r.weight, r.reps, r.session_id, r.started_at);
    END IF;
    IF r.reps > best_r THEN
      best_r := r.reps;
      INSERT INTO personal_records (user_id, exercise_id, record_type, value, weight, reps, session_id, achieved_at)
      VALUES (_uid, _exercise_id, 'max_reps', r.reps, r.weight, r.reps, r.session_id, r.started_at);
    END IF;
    IF r.e1rm IS NOT NULL AND r.e1rm > best_e THEN
      best_e := r.e1rm;
      INSERT INTO personal_records (user_id, exercise_id, record_type, value, weight, reps, session_id, achieved_at)
      VALUES (_uid, _exercise_id, 'est_1rm', r.e1rm, r.weight, r.reps, r.session_id, r.started_at);
    END IF;
    IF r.rn = r.cnt AND r.sess_volume > best_v THEN
      best_v := r.sess_volume;
      INSERT INTO personal_records (user_id, exercise_id, record_type, value, session_id, achieved_at)
      VALUES (_uid, _exercise_id, 'max_volume', r.sess_volume, r.session_id, r.started_at);
    END IF;
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.recompute_personal_records(uuid) TO authenticated;

-- Finish (or re-finalize after editing) a workout; returns new PRs set in this session
CREATE OR REPLACE FUNCTION public.finalize_workout(_session_id uuid)
RETURNS TABLE (exercise_id uuid, exercise_name text, record_type text, value numeric, weight numeric, reps int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _ex uuid;
  _started timestamptz;
BEGIN
  SELECT ws.started_at INTO _started FROM workout_sessions ws WHERE ws.id = _session_id AND ws.user_id = _uid;
  IF _started IS NULL THEN RAISE EXCEPTION 'Workout not found'; END IF;

  -- drop sets that were never completed and exercises left empty
  DELETE FROM workout_sets s USING workout_exercises we
   WHERE s.workout_exercise_id = we.id AND we.session_id = _session_id AND s.completed = false;
  DELETE FROM workout_exercises we WHERE we.session_id = _session_id
   AND NOT EXISTS (SELECT 1 FROM workout_sets s WHERE s.workout_exercise_id = we.id);

  UPDATE workout_sessions ws SET
    status = 'completed',
    ended_at = COALESCE(ws.ended_at, now()),
    duration_seconds = COALESCE(ws.duration_seconds, GREATEST(0, EXTRACT(EPOCH FROM (now() - ws.started_at))::int)),
    total_volume = COALESCE((SELECT SUM(COALESCE(s.weight,0) * COALESCE(s.reps,0)) FROM workout_sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id WHERE we.session_id = _session_id AND s.set_type <> 'warmup'), 0),
    total_sets = (SELECT COUNT(*) FROM workout_sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id WHERE we.session_id = _session_id)
  WHERE ws.id = _session_id;

  FOR _ex IN SELECT DISTINCT we.exercise_id FROM workout_exercises we WHERE we.session_id = _session_id LOOP
    PERFORM public.recompute_personal_records(_ex);
  END LOOP;

  RETURN QUERY
    SELECT pr.exercise_id, e.name, pr.record_type, pr.value, pr.weight, pr.reps
    FROM personal_records pr JOIN exercises e ON e.id = pr.exercise_id
    WHERE pr.user_id = _uid AND pr.session_id = _session_id
    ORDER BY e.name, pr.record_type;
END $$;
GRANT EXECUTE ON FUNCTION public.finalize_workout(uuid) TO authenticated;

-- Delete a workout and rebuild affected PRs
CREATE OR REPLACE FUNCTION public.delete_workout(_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _ids uuid[];
  _ex uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM workout_sessions WHERE id = _session_id AND user_id = _uid) THEN
    RAISE EXCEPTION 'Workout not found';
  END IF;
  SELECT array_agg(DISTINCT exercise_id) INTO _ids FROM workout_exercises WHERE session_id = _session_id;
  DELETE FROM workout_sessions WHERE id = _session_id AND user_id = _uid;
  IF _ids IS NOT NULL THEN
    FOREACH _ex IN ARRAY _ids LOOP PERFORM public.recompute_personal_records(_ex); END LOOP;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.delete_workout(uuid) TO authenticated;

-- Per-session history for one exercise
CREATE OR REPLACE FUNCTION public.exercise_history(_exercise_id uuid)
RETURNS TABLE (session_id uuid, started_at timestamptz, max_weight numeric, max_reps int, est_1rm numeric, volume numeric, sets int)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT ws.id, ws.started_at,
         MAX(s.weight), MAX(s.reps), MAX(public.est_1rm(s.weight, s.reps)),
         COALESCE(SUM(COALESCE(s.weight,0) * COALESCE(s.reps,0)), 0), COUNT(*)::int
  FROM workout_sets s
  JOIN workout_exercises we ON we.id = s.workout_exercise_id
  JOIN workout_sessions ws ON ws.id = we.session_id
  WHERE ws.user_id = auth.uid() AND ws.status = 'completed' AND we.exercise_id = _exercise_id
    AND s.completed AND s.set_type <> 'warmup'
  GROUP BY ws.id, ws.started_at
  ORDER BY ws.started_at
$$;
GRANT EXECUTE ON FUNCTION public.exercise_history(uuid) TO authenticated;

-- Last completed performance for a set of exercises
CREATE OR REPLACE FUNCTION public.last_performance(_exercise_ids uuid[], _exclude_session uuid DEFAULT NULL)
RETURNS TABLE (exercise_id uuid, set_number int, weight numeric, reps int)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH latest AS (
    SELECT DISTINCT ON (we.exercise_id) we.exercise_id, we.id AS we_id
    FROM workout_exercises we JOIN workout_sessions ws ON ws.id = we.session_id
    WHERE ws.user_id = auth.uid() AND ws.status = 'completed'
      AND we.exercise_id = ANY(_exercise_ids)
      AND (_exclude_session IS NULL OR ws.id <> _exclude_session)
    ORDER BY we.exercise_id, ws.started_at DESC
  )
  SELECT l.exercise_id, s.set_number, s.weight, s.reps
  FROM latest l JOIN workout_sets s ON s.workout_exercise_id = l.we_id
  WHERE s.completed
  ORDER BY l.exercise_id, s.set_number
$$;
GRANT EXECUTE ON FUNCTION public.last_performance(uuid[], uuid) TO authenticated;

-- Muscle group distribution since a date
CREATE OR REPLACE FUNCTION public.muscle_group_stats(_since timestamptz)
RETURNS TABLE (category text, sets int, volume numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT e.category, COUNT(*)::int, COALESCE(SUM(COALESCE(s.weight,0) * COALESCE(s.reps,0)), 0)
  FROM workout_sets s
  JOIN workout_exercises we ON we.id = s.workout_exercise_id
  JOIN workout_sessions ws ON ws.id = we.session_id
  JOIN exercises e ON e.id = we.exercise_id
  WHERE ws.user_id = auth.uid() AND ws.status = 'completed' AND s.completed AND ws.started_at >= _since
  GROUP BY e.category
$$;
GRANT EXECUTE ON FUNCTION public.muscle_group_stats(timestamptz) TO authenticated;

-- Most frequently trained exercises
CREATE OR REPLACE FUNCTION public.top_exercises(_limit int DEFAULT 5)
RETURNS TABLE (exercise_id uuid, name text, category text, sessions int)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT e.id, e.name, e.category, COUNT(DISTINCT ws.id)::int
  FROM workout_exercises we
  JOIN workout_sessions ws ON ws.id = we.session_id
  JOIN exercises e ON e.id = we.exercise_id
  WHERE ws.user_id = auth.uid() AND ws.status = 'completed'
  GROUP BY e.id, e.name, e.category
  ORDER BY COUNT(DISTINCT ws.id) DESC, e.name
  LIMIT _limit
$$;
GRANT EXECUTE ON FUNCTION public.top_exercises(int) TO authenticated;

-- ============ SEED EXERCISE LIBRARY ============
INSERT INTO public.exercises (name, category, primary_muscle, secondary_muscles, equipment, instructions) VALUES
('Barbell Bench Press','chest','Pectoralis major',ARRAY['Front delts','Triceps'],'barbell','Lie on a flat bench, grip the bar slightly wider than shoulder width. Lower it to mid-chest with control, then press up until arms are locked out.'),
('Incline Barbell Bench Press','chest','Upper chest',ARRAY['Front delts','Triceps'],'barbell','Set the bench to 30–45°. Lower the bar to the upper chest, keep elbows at roughly 45°, and press back up.'),
('Dumbbell Bench Press','chest','Pectoralis major',ARRAY['Front delts','Triceps'],'dumbbell','Press two dumbbells from chest level to lockout on a flat bench, letting them travel slightly inward at the top.'),
('Incline Dumbbell Press','chest','Upper chest',ARRAY['Front delts','Triceps'],'dumbbell','On an incline bench, lower dumbbells to the sides of the upper chest and press up in a slight arc.'),
('Decline Bench Press','chest','Lower chest',ARRAY['Triceps','Front delts'],'barbell','Secure your legs on a decline bench, lower the bar to the lower chest and press back to lockout.'),
('Dumbbell Fly','chest','Pectoralis major',ARRAY['Front delts'],'dumbbell','With a slight bend in the elbows, open the arms wide until you feel a stretch, then squeeze the dumbbells back together.'),
('Cable Crossover','chest','Pectoralis major',ARRAY['Front delts'],'cable','Stand between two high pulleys, step forward and bring the handles together in front of your hips in a hugging motion.'),
('Machine Chest Press','chest','Pectoralis major',ARRAY['Triceps','Front delts'],'machine','Adjust the seat so handles align with mid-chest. Press forward to full extension and return slowly.'),
('Pec Deck','chest','Pectoralis major',ARRAY['Front delts'],'machine','Sit with back flat against the pad, bring the arms together in front of the chest and return under control.'),
('Push-Up','chest','Pectoralis major',ARRAY['Triceps','Front delts','Core'],'bodyweight','Hands under shoulders, body in a straight line. Lower your chest to the floor and push back up.'),
('Chest Dip','chest','Lower chest',ARRAY['Triceps','Front delts'],'bodyweight','Lean the torso forward on parallel bars, lower until the shoulders are just below the elbows, then press up.'),

('Deadlift','back','Erector spinae',ARRAY['Glutes','Hamstrings','Lats','Traps'],'barbell','Feet hip-width, grip just outside the legs. Brace, push the floor away and stand tall, keeping the bar close to the body.'),
('Pull-Up','back','Latissimus dorsi',ARRAY['Biceps','Rear delts'],'bodyweight','Hang from a bar with an overhand grip, pull until the chin clears the bar, then lower fully.'),
('Chin-Up','back','Latissimus dorsi',ARRAY['Biceps'],'bodyweight','Use an underhand shoulder-width grip and pull your chest towards the bar.'),
('Lat Pulldown','back','Latissimus dorsi',ARRAY['Biceps','Rear delts'],'cable','Pull the bar to the upper chest while driving elbows down and back. Control the return.'),
('Barbell Row','back','Latissimus dorsi',ARRAY['Rhomboids','Rear delts','Biceps'],'barbell','Hinge to about 45°, pull the bar to the lower ribs, squeeze the shoulder blades and lower under control.'),
('Dumbbell Row','back','Latissimus dorsi',ARRAY['Rhomboids','Biceps'],'dumbbell','Support one knee and hand on a bench, row the dumbbell to the hip and lower with a stretch.'),
('Seated Cable Row','back','Middle back',ARRAY['Lats','Biceps','Rear delts'],'cable','Sit tall, pull the handle to your stomach, squeeze the shoulder blades and extend the arms slowly.'),
('T-Bar Row','back','Middle back',ARRAY['Lats','Biceps'],'barbell','Straddle the bar, hinge forward and row the handle to the chest, keeping the back flat.'),
('Chest-Supported Row','back','Middle back',ARRAY['Lats','Rear delts'],'machine','Lie chest-down on an incline pad or machine and row the handles back without using momentum.'),
('Straight-Arm Pulldown','back','Latissimus dorsi',ARRAY['Triceps (long head)'],'cable','With arms nearly straight, sweep the bar from overhead down to the thighs using the lats.'),
('Rack Pull','back','Erector spinae',ARRAY['Traps','Glutes'],'barbell','Set the bar at knee height in a rack and lock out the top portion of a deadlift.'),

('Overhead Press','shoulders','Front deltoids',ARRAY['Triceps','Upper chest'],'barbell','Standing, press the bar from the front of the shoulders to overhead lockout, moving the head through at the top.'),
('Seated Dumbbell Press','shoulders','Front deltoids',ARRAY['Side delts','Triceps'],'dumbbell','Sit upright, press dumbbells from shoulder height to overhead and lower with control.'),
('Arnold Press','shoulders','Front deltoids',ARRAY['Side delts','Triceps'],'dumbbell','Start with palms facing you, rotate them outward as you press overhead.'),
('Lateral Raise','shoulders','Side deltoids',ARRAY['Traps'],'dumbbell','Raise dumbbells out to the sides until arms are parallel to the floor, leading with the elbows.'),
('Cable Lateral Raise','shoulders','Side deltoids',ARRAY['Traps'],'cable','Using a low pulley, raise the handle across and out to shoulder height with one arm.'),
('Front Raise','shoulders','Front deltoids',ARRAY['Upper chest'],'dumbbell','Raise the weights in front of you to shoulder height with straight arms.'),
('Rear Delt Fly','shoulders','Rear deltoids',ARRAY['Rhomboids'],'dumbbell','Hinge forward and raise the dumbbells out to the sides, squeezing the rear shoulders.'),
('Face Pull','shoulders','Rear deltoids',ARRAY['Rotator cuff','Traps'],'cable','Pull a rope at face height towards your forehead, separating the ends and rotating the hands back.'),
('Machine Shoulder Press','shoulders','Front deltoids',ARRAY['Triceps'],'machine','Press the handles overhead to full extension and return slowly.'),
('Barbell Shrug','shoulders','Trapezius',ARRAY['Forearms'],'barbell','Hold the bar at arm''s length and shrug the shoulders straight up, pausing at the top.'),

('Barbell Curl','biceps','Biceps brachii',ARRAY['Forearms'],'barbell','Keep elbows at your sides and curl the bar to shoulder height, then lower slowly.'),
('Dumbbell Curl','biceps','Biceps brachii',ARRAY['Forearms'],'dumbbell','Curl the dumbbells while supinating the wrists, keeping the upper arms still.'),
('Hammer Curl','biceps','Brachialis',ARRAY['Brachioradialis'],'dumbbell','Curl with a neutral grip (palms facing each other).'),
('Incline Dumbbell Curl','biceps','Biceps (long head)',ARRAY['Forearms'],'dumbbell','Sit back on an incline bench, arms hanging, and curl without moving the shoulders.'),
('Preacher Curl','biceps','Biceps brachii',ARRAY['Brachialis'],'ez bar','Rest the upper arms on a preacher pad and curl the bar up, lowering to near full extension.'),
('Cable Curl','biceps','Biceps brachii',ARRAY['Forearms'],'cable','Curl a bar or rope attached to a low pulley, keeping constant tension.'),
('Concentration Curl','biceps','Biceps brachii',ARRAY[]::text[],'dumbbell','Seated, brace the elbow against the inner thigh and curl the dumbbell.'),
('EZ-Bar Curl','biceps','Biceps brachii',ARRAY['Brachialis'],'ez bar','Curl the EZ bar with an angled grip that is easier on the wrists.'),

('Close-Grip Bench Press','triceps','Triceps brachii',ARRAY['Chest','Front delts'],'barbell','Grip the bar about shoulder width, keep elbows tucked and press.'),
('Triceps Pushdown','triceps','Triceps brachii',ARRAY[]::text[],'cable','Push the bar or rope down until the arms are straight, keeping elbows pinned to your sides.'),
('Overhead Triceps Extension','triceps','Triceps (long head)',ARRAY[]::text[],'dumbbell','Hold a dumbbell overhead with both hands, lower it behind the head and extend.'),
('Skull Crusher','triceps','Triceps brachii',ARRAY[]::text[],'ez bar','Lying on a bench, lower the bar to the forehead by bending only at the elbows, then extend.'),
('Triceps Dip','triceps','Triceps brachii',ARRAY['Chest','Front delts'],'bodyweight','Keep the torso upright on parallel bars and lower until elbows reach 90°, then press up.'),
('Cable Overhead Extension','triceps','Triceps (long head)',ARRAY[]::text[],'cable','Facing away from the pulley, extend the rope overhead from behind the head.'),
('Dumbbell Kickback','triceps','Triceps brachii',ARRAY[]::text[],'dumbbell','Hinge forward, upper arm parallel to the floor, and extend the forearm back.'),
('Diamond Push-Up','triceps','Triceps brachii',ARRAY['Chest'],'bodyweight','Do a push-up with hands together under the chest forming a diamond.'),

('Back Squat','quadriceps','Quadriceps',ARRAY['Glutes','Adductors','Core'],'barbell','Bar on the upper back, brace, sit down between the hips to at least parallel and drive up.'),
('Front Squat','quadriceps','Quadriceps',ARRAY['Glutes','Core'],'barbell','Rack the bar on the front delts, keep elbows high and squat with an upright torso.'),
('Leg Press','quadriceps','Quadriceps',ARRAY['Glutes','Hamstrings'],'machine','Lower the sled until knees reach about 90°, then press without locking the knees hard.'),
('Hack Squat','quadriceps','Quadriceps',ARRAY['Glutes'],'machine','With shoulders under the pads, squat down deep and drive back up through the mid-foot.'),
('Leg Extension','quadriceps','Quadriceps',ARRAY[]::text[],'machine','Extend the knees fully, squeeze the quads and lower slowly.'),
('Bulgarian Split Squat','quadriceps','Quadriceps',ARRAY['Glutes','Adductors'],'dumbbell','Rear foot on a bench, lower the back knee towards the floor and drive up through the front foot.'),
('Walking Lunge','quadriceps','Quadriceps',ARRAY['Glutes','Hamstrings'],'dumbbell','Step forward into a lunge, then bring the back foot through into the next step.'),
('Goblet Squat','quadriceps','Quadriceps',ARRAY['Glutes','Core'],'dumbbell','Hold a dumbbell at your chest and squat between the knees with an upright torso.'),

('Romanian Deadlift','hamstrings','Hamstrings',ARRAY['Glutes','Erector spinae'],'barbell','With soft knees, hinge at the hips sliding the bar down the thighs until you feel a deep stretch, then stand up.'),
('Lying Leg Curl','hamstrings','Hamstrings',ARRAY['Calves'],'machine','Lying face down, curl the pad towards your glutes and lower slowly.'),
('Seated Leg Curl','hamstrings','Hamstrings',ARRAY[]::text[],'machine','Seated with thighs locked in, curl the pad under the seat.'),
('Stiff-Leg Deadlift','hamstrings','Hamstrings',ARRAY['Glutes','Lower back'],'barbell','Keep the legs nearly straight and hinge forward with a flat back.'),
('Good Morning','hamstrings','Hamstrings',ARRAY['Erector spinae','Glutes'],'barbell','Bar on the upper back, hinge forward at the hips with soft knees and return upright.'),
('Nordic Hamstring Curl','hamstrings','Hamstrings',ARRAY[]::text[],'bodyweight','Kneel with ankles anchored and lower your body forward as slowly as possible.'),
('Dumbbell Romanian Deadlift','hamstrings','Hamstrings',ARRAY['Glutes'],'dumbbell','Hinge with dumbbells close to the legs until you feel a hamstring stretch.'),

('Barbell Hip Thrust','glutes','Gluteus maximus',ARRAY['Hamstrings'],'barbell','Upper back on a bench, bar over the hips. Drive the hips up until the torso is level and squeeze the glutes.'),
('Glute Bridge','glutes','Gluteus maximus',ARRAY['Hamstrings'],'bodyweight','Lying on your back, drive through the heels and lift the hips.'),
('Cable Kickback','glutes','Gluteus maximus',ARRAY['Hamstrings'],'cable','With an ankle strap, kick the leg straight back while keeping the torso still.'),
('Hip Abduction Machine','glutes','Gluteus medius',ARRAY[]::text[],'machine','Push the pads outward with the knees and return slowly.'),
('Sumo Deadlift','glutes','Gluteus maximus',ARRAY['Adductors','Quadriceps','Hamstrings'],'barbell','Take a wide stance, grip inside the knees and push the floor apart as you stand up.'),
('Step-Up','glutes','Gluteus maximus',ARRAY['Quadriceps'],'dumbbell','Step onto a box with one foot and drive up through that heel.'),

('Standing Calf Raise','calves','Gastrocnemius',ARRAY['Soleus'],'machine','Rise onto the balls of the feet as high as possible, pause and lower into a full stretch.'),
('Seated Calf Raise','calves','Soleus',ARRAY['Gastrocnemius'],'machine','Seated with knees under the pad, raise the heels and lower slowly.'),
('Leg Press Calf Raise','calves','Gastrocnemius',ARRAY['Soleus'],'machine','On the leg press, push the sled with the balls of your feet through a full range.'),
('Single-Leg Calf Raise','calves','Gastrocnemius',ARRAY['Soleus'],'bodyweight','Standing on one foot on a step, rise up and lower below the step.'),

('Plank','abs','Rectus abdominis',ARRAY['Obliques','Transverse abdominis'],'bodyweight','Hold a straight line from head to heels on your forearms. Log reps as seconds held.'),
('Hanging Leg Raise','abs','Lower abs',ARRAY['Hip flexors','Obliques'],'bodyweight','Hang from a bar and raise the legs to hip height or above without swinging.'),
('Cable Crunch','abs','Rectus abdominis',ARRAY['Obliques'],'cable','Kneel below a high pulley holding a rope and crunch the ribs towards the hips.'),
('Ab Wheel Rollout','abs','Rectus abdominis',ARRAY['Lats','Shoulders'],'bodyweight','From kneeling, roll the wheel forward as far as you can control and pull back.'),
('Russian Twist','abs','Obliques',ARRAY['Rectus abdominis'],'bodyweight','Seated and leaning back, rotate the torso side to side.'),
('Crunch','abs','Rectus abdominis',ARRAY[]::text[],'bodyweight','Lying with knees bent, curl the shoulders off the floor towards the pelvis.'),
('Decline Sit-Up','abs','Rectus abdominis',ARRAY['Hip flexors'],'bodyweight','On a decline bench, sit up fully and lower under control.');
