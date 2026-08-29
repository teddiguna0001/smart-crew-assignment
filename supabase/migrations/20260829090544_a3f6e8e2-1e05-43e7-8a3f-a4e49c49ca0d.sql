CREATE TYPE public.bus_status AS ENUM ('active','maintenance','retired','inactive');
CREATE TYPE public.crew_status AS ENUM ('active','off_duty','inactive');

CREATE TABLE public.depots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.depots TO anon, authenticated;
GRANT ALL ON public.depots TO service_role;
ALTER TABLE public.depots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "depots readable" ON public.depots FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.buses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  depot_id uuid NOT NULL REFERENCES public.depots(id) ON DELETE CASCADE,
  status public.bus_status NOT NULL DEFAULT 'active',
  capacity int NOT NULL DEFAULT 50,
  utilization_minutes int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.buses TO anon, authenticated;
GRANT ALL ON public.buses TO service_role;
ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "buses readable" ON public.buses FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.crew (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  depot_id uuid NOT NULL REFERENCES public.depots(id) ON DELETE CASCADE,
  status public.crew_status NOT NULL DEFAULT 'active',
  is_available boolean NOT NULL DEFAULT true,
  shift_start time NOT NULL DEFAULT '05:00',
  shift_end time NOT NULL DEFAULT '23:00',
  utilization_minutes int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.crew TO anon, authenticated;
GRANT ALL ON public.crew TO service_role;
ALTER TABLE public.crew ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crew readable" ON public.crew FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  origin_depot_id uuid NOT NULL REFERENCES public.depots(id) ON DELETE CASCADE,
  destination text NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  required_capacity int NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.trips TO anon, authenticated;
GRANT ALL ON public.trips TO service_role;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trips readable" ON public.trips FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL UNIQUE REFERENCES public.trips(id) ON DELETE CASCADE,
  bus_id uuid NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
  crew_id uuid NOT NULL REFERENCES public.crew(id) ON DELETE CASCADE,
  score numeric NOT NULL DEFAULT 0,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.assignments TO anon, authenticated;
GRANT ALL ON public.assignments TO service_role;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assignments readable" ON public.assignments FOR SELECT TO anon, authenticated USING (true);

-- Hard database guarantee: no overlapping bus/crew bookings, no inactive/retired resources.
CREATE OR REPLACE FUNCTION public.validate_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  t_start timestamptz;
  t_end timestamptz;
  bstatus public.bus_status;
  cstatus public.crew_status;
  cavail boolean;
BEGIN
  SELECT start_time, end_time INTO t_start, t_end FROM public.trips WHERE id = NEW.trip_id;

  SELECT status INTO bstatus FROM public.buses WHERE id = NEW.bus_id;
  IF bstatus <> 'active' THEN
    RAISE EXCEPTION 'Bus % is not active (status %)', NEW.bus_id, bstatus;
  END IF;

  SELECT status, is_available INTO cstatus, cavail FROM public.crew WHERE id = NEW.crew_id;
  IF cstatus <> 'active' OR cavail IS NOT TRUE THEN
    RAISE EXCEPTION 'Crew % is not available', NEW.crew_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.assignments a
    JOIN public.trips tr ON tr.id = a.trip_id
    WHERE a.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND a.bus_id = NEW.bus_id
      AND tr.start_time < t_end AND tr.end_time > t_start
  ) THEN
    RAISE EXCEPTION 'Bus % already assigned to an overlapping trip', NEW.bus_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.assignments a
    JOIN public.trips tr ON tr.id = a.trip_id
    WHERE a.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND a.crew_id = NEW.crew_id
      AND tr.start_time < t_end AND tr.end_time > t_start
  ) THEN
    RAISE EXCEPTION 'Crew % already assigned to an overlapping trip', NEW.crew_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER assignments_validate
BEFORE INSERT OR UPDATE ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public.validate_assignment();

-- Demo data
INSERT INTO public.depots (id, name, lat, lng) VALUES
  ('11111111-1111-1111-1111-111111111101','North Depot', 30.10, 31.35),
  ('11111111-1111-1111-1111-111111111102','Central Depot', 30.04, 31.24),
  ('11111111-1111-1111-1111-111111111103','South Depot', 29.95, 31.26);

INSERT INTO public.buses (id, code, depot_id, status, capacity, utilization_minutes) VALUES
  ('22222222-2222-2222-2222-222222222201','BUS-101','11111111-1111-1111-1111-111111111101','active',52,180),
  ('22222222-2222-2222-2222-222222222202','BUS-102','11111111-1111-1111-1111-111111111101','active',45,60),
  ('22222222-2222-2222-2222-222222222203','BUS-103','11111111-1111-1111-1111-111111111101','maintenance',52,0),
  ('22222222-2222-2222-2222-222222222204','BUS-201','11111111-1111-1111-1111-111111111102','active',60,240),
  ('22222222-2222-2222-2222-222222222205','BUS-202','11111111-1111-1111-1111-111111111102','retired',40,0),
  ('22222222-2222-2222-2222-222222222206','BUS-203','11111111-1111-1111-1111-111111111102','active',35,30),
  ('22222222-2222-2222-2222-222222222207','BUS-301','11111111-1111-1111-1111-111111111103','inactive',50,0),
  ('22222222-2222-2222-2222-222222222208','BUS-302','11111111-1111-1111-1111-111111111103','active',55,90);

INSERT INTO public.crew (id, name, depot_id, status, is_available, shift_start, shift_end, utilization_minutes) VALUES
  ('33333333-3333-3333-3333-333333333301','Amina Hassan','11111111-1111-1111-1111-111111111101','active',true,'05:00','15:00',120),
  ('33333333-3333-3333-3333-333333333302','Karim Fouad','11111111-1111-1111-1111-111111111101','active',true,'06:00','18:00',60),
  ('33333333-3333-3333-3333-333333333303','Nadia Salah','11111111-1111-1111-1111-111111111101','off_duty',false,'05:00','15:00',0),
  ('33333333-3333-3333-3333-333333333304','Omar Zaki','11111111-1111-1111-1111-111111111102','active',true,'04:00','16:00',200),
  ('33333333-3333-3333-3333-333333333305','Laila Mansour','11111111-1111-1111-1111-111111111102','active',false,'08:00','20:00',0),
  ('33333333-3333-3333-3333-333333333306','Youssef Adel','11111111-1111-1111-1111-111111111102','active',true,'08:00','22:00',45),
  ('33333333-3333-3333-3333-333333333307','Hana Rashid','11111111-1111-1111-1111-111111111103','inactive',true,'06:00','18:00',0),
  ('33333333-3333-3333-3333-333333333308','Tarek Nabil','11111111-1111-1111-1111-111111111103','active',true,'05:00','19:00',150);

INSERT INTO public.trips (id, code, origin_depot_id, destination, start_time, end_time, required_capacity) VALUES
  ('44444444-4444-4444-4444-444444444401','TR-001','11111111-1111-1111-1111-111111111101','Airport Terminal', date_trunc('day', now()) + interval '7 hours', date_trunc('day', now()) + interval '9 hours', 40),
  ('44444444-4444-4444-4444-444444444402','TR-002','11111111-1111-1111-1111-111111111101','City Center', date_trunc('day', now()) + interval '8 hours', date_trunc('day', now()) + interval '10 hours', 30),
  ('44444444-4444-4444-4444-444444444403','TR-003','11111111-1111-1111-1111-111111111102','Industrial Park', date_trunc('day', now()) + interval '9 hours', date_trunc('day', now()) + interval '11 hours 30 minutes', 55),
  ('44444444-4444-4444-4444-444444444404','TR-004','11111111-1111-1111-1111-111111111102','University Campus', date_trunc('day', now()) + interval '10 hours', date_trunc('day', now()) + interval '12 hours', 32),
  ('44444444-4444-4444-4444-444444444405','TR-005','11111111-1111-1111-1111-111111111103','Coastal Route', date_trunc('day', now()) + interval '9 hours 30 minutes', date_trunc('day', now()) + interval '13 hours', 45),
  ('44444444-4444-4444-4444-444444444406','TR-006','11111111-1111-1111-1111-111111111103','Night Express', date_trunc('day', now()) + interval '21 hours', date_trunc('day', now()) + interval '23 hours', 25);