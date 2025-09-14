create extension if not exists pgcrypto;

create table if not exists public.scenarios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.train_positions (
  id uuid primary key default gen_random_uuid(),
  train_no text not null,
  lat double precision not null,
  lon double precision not null,
  speed_kmph double precision,
  ts timestamptz not null default now()
);

alter table public.scenarios enable row level security;
create policy if not exists "scenarios-read" on public.scenarios for select using (true);
alter table public.train_positions enable row level security;
create policy if not exists "train_positions-read" on public.train_positions for select using (true);


create index if not exists idx_train_positions_ts on public.train_positions (ts desc);
create index if not exists idx_train_positions_train_no_ts on public.train_positions (train_no, ts desc);


-- Profiles map Clerk users to roles; clerk_id = Clerk user ID (sub)
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_id text unique not null,
  email text,
  role text not null check (role in ('admin','controller','analyst')),
  created_at timestamptz not null default now()
);

-- Core domain tables
create table if not exists public.trains (
  id uuid primary key default gen_random_uuid(),
  type text,
  speed double precision,
  location jsonb, -- { lat, lon }
  energy double precision,
  delay integer,
  updated_at timestamptz not null default now()
);

create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  tracks jsonb, -- GeoJSON or array of track segments
  capacity integer,
  congestion_level integer default 0
);

create table if not exists public.signals (
  id uuid primary key default gen_random_uuid(),
  section_id uuid references public.sections(id) on delete cascade,
  status text not null check (status in ('green','yellow','red')),
  updated_at timestamptz not null default now()
);

create table if not exists public.conflicts (
  id uuid primary key default gen_random_uuid(),
  train_a text not null,
  train_b text not null,
  predicted_time timestamptz not null,
  severity text not null check (severity in ('low','medium','high'))
);

create table if not exists public.energy_logs (
  id uuid primary key default gen_random_uuid(),
  train_id uuid references public.trains(id) on delete cascade,
  baseline double precision not null,
  optimized double precision not null,
  timestamp timestamptz not null default now()
);

-- RLS helpers: resolve Clerk subject from external JWT claims (requires PostgREST config)
create or replace function public.jwt_sub()
returns text language sql stable as $$
  select coalesce(current_setting('request.jwt.claims', true)::jsonb->>'sub', null)
$$;

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.trains enable row level security;
alter table public.sections enable row level security;
alter table public.signals enable row level security;
alter table public.conflicts enable row level security;
alter table public.energy_logs enable row level security;

-- Policies: allow read to all for prototype; restrict writes by role
create policy if not exists "profiles-self-read" on public.profiles for select using (true);
create policy if not exists "profiles-admin-write" on public.profiles for all
  using (exists (select 1 from public.profiles p where p.clerk_id = public.jwt_sub() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.clerk_id = public.jwt_sub() and p.role = 'admin'));

create policy if not exists "trains-read" on public.trains for select using (true);
create policy if not exists "trains-write" on public.trains for insert with check (
  exists (select 1 from public.profiles p where p.clerk_id = public.jwt_sub() and p.role in ('admin','controller'))
);
create policy if not exists "trains-update" on public.trains for update using (
  exists (select 1 from public.profiles p where p.clerk_id = public.jwt_sub() and p.role in ('admin','controller'))
);

create policy if not exists "sections-read" on public.sections for select using (true);
create policy if not exists "sections-write" on public.sections for all using (
  exists (select 1 from public.profiles p where p.clerk_id = public.jwt_sub() and p.role = 'admin')
) with check (
  exists (select 1 from public.profiles p where p.clerk_id = public.jwt_sub() and p.role = 'admin')
);

create policy if not exists "signals-read" on public.signals for select using (true);
create policy if not exists "signals-write" on public.signals for all using (
  exists (select 1 from public.profiles p where p.clerk_id = public.jwt_sub() and p.role in ('admin','controller'))
) with check (
  exists (select 1 from public.profiles p where p.clerk_id = public.jwt_sub() and p.role in ('admin','controller'))
);

create policy if not exists "conflicts-read" on public.conflicts for select using (true);
create policy if not exists "conflicts-write" on public.conflicts for all using (
  exists (select 1 from public.profiles p where p.clerk_id = public.jwt_sub() and p.role in ('admin','analyst'))
) with check (
  exists (select 1 from public.profiles p where p.clerk_id = public.jwt_sub() and p.role in ('admin','analyst'))
);

create policy if not exists "energy_logs-read" on public.energy_logs for select using (true);
create policy if not exists "energy_logs-write" on public.energy_logs for all using (
  exists (select 1 from public.profiles p where p.clerk_id = public.jwt_sub() and p.role in ('admin','analyst'))
) with check (
  exists (select 1 from public.profiles p where p.clerk_id = public.jwt_sub() and p.role in ('admin','analyst'))
);

-- Realtime
alter publication supabase_realtime add table public.trains;
alter publication supabase_realtime add table public.signals;
alter publication supabase_realtime add table public.conflicts;
alter publication supabase_realtime add table public.train_positions;
alter publication supabase_realtime add table public.energy_logs;