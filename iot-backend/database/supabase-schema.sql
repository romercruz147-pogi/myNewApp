-- Romers Vendo Supabase schema (production)
create extension if not exists pgcrypto;

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  device_id text not null unique,
  device_secret_hash text not null unique,
  device_name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'disabled', 'revoked')),
  last_seen timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.device_activity_logs (
  id uuid primary key default gen_random_uuid(),
  device_id text not null references public.devices(device_id) on delete cascade,
  event_type text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.devices enable row level security;
alter table public.device_activity_logs enable row level security;

create policy "admins can register devices" on public.devices
for insert to authenticated
with check (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.role = 'admin'
));

create policy "owners can read own devices" on public.devices
for select to authenticated
using (owner_id = auth.uid());

create policy "owners can read logs" on public.device_activity_logs
for select to authenticated
using (exists (
  select 1 from public.devices d
  where d.device_id = device_activity_logs.device_id and d.owner_id = auth.uid()
));
