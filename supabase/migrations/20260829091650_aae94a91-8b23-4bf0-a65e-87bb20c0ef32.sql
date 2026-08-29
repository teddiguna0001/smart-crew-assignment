DROP TABLE IF EXISTS public.assignments CASCADE;
DROP TABLE IF EXISTS public.trips CASCADE;
DROP TABLE IF EXISTS public.buses CASCADE;
DROP TABLE IF EXISTS public.crew CASCADE;
DROP TABLE IF EXISTS public.depots CASCADE;
DROP TYPE IF EXISTS public.bus_status CASCADE;
DROP TYPE IF EXISTS public.crew_status CASCADE;

CREATE TYPE public.bus_status AS ENUM ('AVAILABLE','ASSIGNED','MAINTENANCE','INACTIVE','RETIRED');

CREATE TABLE public.buses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_code text NOT NULL UNIQUE,
  bus_number text NOT NULL UNIQUE,
  depot text NOT NULL,
  capacity integer NOT NULL DEFAULT 40 CHECK (capacity > 0 AND capacity < 200),
  bus_type text NOT NULL DEFAULT 'Standard CNG AC',
  status public.bus_status NOT NULL DEFAULT 'AVAILABLE',
  model text,
  energy_pct integer NOT NULL DEFAULT 100 CHECK (energy_pct >= 0 AND energy_pct <= 100),
  odometer_km integer NOT NULL DEFAULT 0 CHECK (odometer_km >= 0),
  current_assignment text,
  last_maintenance date,
  next_inspection_due date,
  efficiency_score numeric(5,2),
  retired_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.bus_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id uuid NOT NULL REFERENCES public.buses(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  from_status public.bus_status,
  to_status public.bus_status,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bus_events_bus_id_idx ON public.bus_events (bus_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.buses TO anon, authenticated;
GRANT ALL ON public.buses TO service_role;
GRANT SELECT, INSERT ON public.bus_events TO anon, authenticated;
GRANT ALL ON public.bus_events TO service_role;

ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bus_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fleet buses are readable" ON public.buses FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Fleet buses can be added" ON public.buses FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Fleet buses can be updated" ON public.buses FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Bus history is readable" ON public.bus_events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Bus history can be appended" ON public.bus_events FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER buses_set_updated_at BEFORE UPDATE ON public.buses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.buses (bus_code, bus_number, depot, capacity, bus_type, status, model, energy_pct, odometer_km, current_assignment, last_maintenance, next_inspection_due, efficiency_score) VALUES
('BUS-1042', 'DL-1PD-4219', 'Sukhdev Vihar (EV Central)', 42, 'Low Floor Electric', 'ASSIGNED', 'Tata Starbus EV Ultra 12m', 78, 38450, 'Route 522 / Trip 522-UP-0815', '2026-08-10', '2026-09-10', 94.2),
('BUS-1088', 'DL-1PC-7824', 'Mayapuri Depot', 40, 'Standard CNG AC', 'ASSIGNED', 'Ashok Leyland CNG AC JanBus', 64, 142100, 'Route TMS (+) / Trip TMS-CL-0900', '2026-07-28', '2026-08-30', 88.5),
('BUS-1017', 'DL-1PD-9017', 'Sarojini Nagar Depot', 42, 'Low Floor Electric', 'MAINTENANCE', 'JBM ECO-LIFE e12 EV', 52, 29800, 'Route 505 (Pneumatic Inverter Fault)', '2026-08-01', '2026-09-01', 79.1),
('VEH-04', 'DL-1PD-9082', 'Sarojini Nagar Depot', 42, 'Low Floor Electric', 'AVAILABLE', 'JBM ECO-LIFE e12 EV (Standby Reserve)', 96, 18200, 'Ready for Quick Recovery Dispatch', '2026-08-18', '2026-09-18', 96.8),
('BUS-1120', 'DL-1PC-2204', 'Nehru Place Terminal Depot', 48, 'Standard CNG Non-AC', 'ASSIGNED', 'Tata Marcopolo CNG Low Floor', 81, 189400, 'Route 764 / Trip 764-DN-1015', '2026-08-05', '2026-09-05', 85),
('BUS-1155', 'DL-1PD-3311', 'Sukhdev Vihar (EV Central)', 42, 'Low Floor Electric', 'ASSIGNED', 'Tata Starbus EV Ultra 12m', 92, 22100, 'Route 429 / Trip 429-UP-1100', '2026-08-14', '2026-09-14', 95.1),
('BUS-1192', 'DL-1PC-6641', 'Rohini Depot-I', 40, 'Standard CNG AC', 'ASSIGNED', 'Ashok Leyland CNG AC JanBus', 59, 128900, 'Route 883 / Trip 883-UP-1115', '2026-07-20', '2026-08-30', 89.2),
('BUS-1204', 'DL-1PD-1199', 'Sarojini Nagar Depot', 42, 'Low Floor Electric', 'AVAILABLE', 'Olectra K9 Electric Low Floor', 88, 34200, 'Turnaround Bay Shivaji Stadium', '2026-08-12', '2026-09-12', 93.4),
('BUS-1288', 'DL-1PC-8472', 'Rohini Depot-I', 40, 'Standard CNG AC', 'ASSIGNED', 'Ashok Leyland CNG 12m', 74, 45754, 'Route TMS (+)', '2026-08-05', '2026-09-05', 90);

INSERT INTO public.bus_events (bus_id, event_type, to_status, detail)
SELECT id, 'CREATED', status, 'Imported from depot inventory' FROM public.buses;

CREATE TYPE public.crew_status AS ENUM ('AVAILABLE','ASSIGNED','OFF_DUTY','UNAVAILABLE','INACTIVE');

CREATE TABLE public.crew (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_code text NOT NULL UNIQUE,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'Driver',
  depot text NOT NULL,
  shift text NOT NULL DEFAULT 'Morning (06:00-14:00)',
  status public.crew_status NOT NULL DEFAULT 'AVAILABLE',
  availability text NOT NULL DEFAULT 'Full shift',
  phone text,
  license_valid_till date,
  weekly_hours numeric(5,1) NOT NULL DEFAULT 0 CHECK (weekly_hours >= 0),
  daily_spreadover_hours numeric(4,1) NOT NULL DEFAULT 0 CHECK (daily_spreadover_hours >= 0),
  consecutive_days integer NOT NULL DEFAULT 0 CHECK (consecutive_days >= 0),
  punctuality_score numeric(5,2),
  current_assignment text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crew_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id uuid NOT NULL REFERENCES public.crew(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  from_status public.crew_status,
  to_status public.crew_status,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX crew_events_crew_id_idx ON public.crew_events (crew_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.crew TO anon, authenticated;
GRANT ALL ON public.crew TO service_role;
GRANT SELECT, INSERT ON public.crew_events TO anon, authenticated;
GRANT ALL ON public.crew_events TO service_role;

ALTER TABLE public.crew ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crew are readable" ON public.crew FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Crew can be added" ON public.crew FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Crew can be updated" ON public.crew FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Crew history is readable" ON public.crew_events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Crew history can be appended" ON public.crew_events FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE TRIGGER crew_set_updated_at BEFORE UPDATE ON public.crew
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.crew (crew_code, name, role, depot, shift, status, availability, phone, license_valid_till, weekly_hours, daily_spreadover_hours, consecutive_days, punctuality_score, current_assignment) VALUES
('DTC-D-7812','Rameshwar Dayal','Driver','Sukhdev Vihar (EV Central)','Morning (06:00-14:00)','ASSIGNED','On duty till 14:00','+91 98102 33419','2028-11-15',36.5,5.2,4,98.4,'Trip 522-UP-0815'),
('DTC-D-3382','Balwan Singh','Driver','Sarojini Nagar Depot','Morning (06:00-14:00)','ASSIGNED','On duty till 14:00','+91 98114 90123','2027-04-20',41.0,6.8,5,94.1,'Trip 505-UP-1030'),
('DTC-D-5521','Sanjay Kumar','Driver','Anand Vihar ISBT Depot','Morning (06:00-14:00)','ASSIGNED','On duty till 14:00','+91 98731 55601','2029-01-10',32.0,4.5,3,96.8,'Trip TMS-CL-0900'),
('DTC-D-9082','Devinder Rawat','Driver','Sarojini Nagar Depot','Full day (06:00-22:00)','AVAILABLE','Depot Reserve Tier-1','+91 98188 77209','2028-08-30',24.0,1.5,2,99.1,NULL),
('DTC-C-1142','Virender Kumar','Conductor','Sukhdev Vihar (EV Central)','Morning (06:00-14:00)','ASSIGNED','On duty till 14:00','+91 98991 22409','2030-05-12',38.0,5.2,4,97.5,'Trip 522-UP-0815'),
('DTC-C-4421','Mahesh Sharma','Conductor','Sarojini Nagar Depot','Morning (06:00-14:00)','ASSIGNED','On duty till 14:00','+91 99105 88921','2029-10-18',42.5,6.8,5,95.0,'Trip 505-UP-1030'),
('DTC-C-6019','Mukesh Tyagi','Conductor','Sarojini Nagar Depot','Full day (06:00-22:00)','AVAILABLE','Depot Reserve Tier-1','+91 98110 44312','2028-12-05',22.0,1.5,2,98.9,NULL),
('DTC-D-4109','Jagdish Chand','Driver','Sukhdev Vihar (EV Central)','Afternoon (14:00-22:00)','OFF_DUTY','Mandatory 45-min break','+91 98109 33902','2027-09-14',28.0,4.0,3,96.2,NULL),
('DTC-D-6231','Dharampal Gill','Driver','Sarojini Nagar Depot','Afternoon (14:00-22:00)','AVAILABLE','Reports 13:30','+91 98115 77120','2029-03-22',30.0,2.0,1,97.2,NULL),
('DTC-C-5541','Deepak Rawat','Conductor','Sarojini Nagar Depot','Afternoon (14:00-22:00)','AVAILABLE','Reports 13:30','+91 98104 66210','2029-06-11',26.5,2.0,1,96.4,NULL),
('DTC-D-8802','Satender Yadav','Driver','Rohini Depot-I','Morning (06:00-14:00)','AVAILABLE','Standby at Rohini-I','+91 98991 40021','2028-02-19',20.0,1.0,1,95.6,NULL),
('DTC-C-7210','Naresh Chand','Conductor','Rohini Depot-I','Morning (06:00-14:00)','UNAVAILABLE','Reported sick leave','+91 98183 55190','2027-12-30',12.0,0.0,0,93.8,NULL),
('DTC-S-2201','Anita Verma','Shift In-Charge','Sukhdev Vihar (EV Central)','Full day (06:00-22:00)','AVAILABLE','Control room supervision','+91 98100 11223','2031-01-05',44.0,7.5,5,99.4,NULL),
('DTC-D-3320','Om Prakash','Driver','Mayapuri Depot','Night (22:00-06:00)','INACTIVE','Long leave','+91 98104 22110','2026-11-01',0.0,0.0,0,90.1,NULL);

INSERT INTO public.crew_events (crew_id, event_type, to_status, detail)
SELECT id, 'CREATED', status, 'Imported from depot roster' FROM public.crew;

CREATE TABLE public.trip_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id text NOT NULL,
  trip_code text NOT NULL,
  route_number text NOT NULL,
  origin text,
  destination text,
  depot text NOT NULL,
  start_min integer NOT NULL,
  end_min integer NOT NULL,
  bus_id uuid REFERENCES public.buses(id) ON DELETE SET NULL,
  bus_label text,
  driver_id uuid REFERENCES public.crew(id) ON DELETE SET NULL,
  driver_name text,
  conductor_id uuid REFERENCES public.crew(id) ON DELETE SET NULL,
  conductor_name text,
  delay_min integer NOT NULL DEFAULT 0,
  same_depot boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'AUTO_ASSIGN',
  disruption_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id)
);

CREATE INDEX trip_assignments_route_idx ON public.trip_assignments (route_number, start_min);

CREATE TABLE public.disruptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL,
  route_number text NOT NULL,
  disruption_type text NOT NULL,
  severity text NOT NULL,
  start_min integer NOT NULL,
  duration_min integer NOT NULL,
  location text,
  description text,
  status text NOT NULL DEFAULT 'ACTIVE',
  affected_trips integer NOT NULL DEFAULT 0,
  affected_bus_ids uuid[] NOT NULL DEFAULT '{}',
  affected_crew_ids uuid[] NOT NULL DEFAULT '{}',
  recovered_trips integer NOT NULL DEFAULT 0,
  unrecovered_trips integer NOT NULL DEFAULT 0,
  recovery_rate_pct integer NOT NULL DEFAULT 0,
  added_delay_min integer NOT NULL DEFAULT 0,
  passengers_impacted integer NOT NULL DEFAULT 0,
  impact jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX disruptions_status_idx ON public.disruptions (status, created_at DESC);

CREATE TABLE public.scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied boolean NOT NULL DEFAULT false,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX scenarios_created_idx ON public.scenarios (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_assignments TO anon, authenticated;
GRANT ALL ON public.trip_assignments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disruptions TO anon, authenticated;
GRANT ALL ON public.disruptions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scenarios TO anon, authenticated;
GRANT ALL ON public.scenarios TO service_role;

ALTER TABLE public.trip_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disruptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Assignments are readable" ON public.trip_assignments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Assignments can be written" ON public.trip_assignments FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Assignments can be updated" ON public.trip_assignments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Assignments can be cleared" ON public.trip_assignments FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "Disruptions are readable" ON public.disruptions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Disruptions can be raised" ON public.disruptions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Disruptions can be updated" ON public.disruptions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Disruptions can be deleted" ON public.disruptions FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "Scenarios are readable" ON public.scenarios FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Scenarios can be created" ON public.scenarios FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Scenarios can be updated" ON public.scenarios FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Scenarios can be deleted" ON public.scenarios FOR DELETE TO anon, authenticated USING (true);

CREATE TRIGGER trip_assignments_set_updated_at BEFORE UPDATE ON public.trip_assignments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER disruptions_set_updated_at BEFORE UPDATE ON public.disruptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER scenarios_set_updated_at BEFORE UPDATE ON public.scenarios
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();