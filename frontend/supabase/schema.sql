-- Supabase schema for Trakshya minimal backend
-- Enable pgcrypto for gen_random_uuid if not already enabled
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

-- Basic RLS (optional): allow read to anon, write only to service role
alter table public.scenarios enable row level security;
create policy if not exists "scenarios-read" on public.scenarios for select using (true);
alter table public.train_positions enable row level security;
create policy if not exists "train_positions-read" on public.train_positions for select using (true);

