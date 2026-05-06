-- Run this in Supabase SQL Editor.
-- Device secrets are NEVER stored as plain text. Store only device_secret_hash.

create extension if not exists pgcrypto;

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  device_id text not null unique,
  device_secret_hash text not null,
  owner uuid null,
  status text not null default 'active' check (status in ('active', 'disabled', 'revoked')),
  name text null,
  last_ip text null,
  last_seen timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_devices_owner on public.devices(owner);
create index if not exists idx_devices_status on public.devices(status);
create index if not exists idx_devices_last_seen on public.devices(last_seen desc);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_devices_updated_at on public.devices;
create trigger trg_devices_updated_at
before update on public.devices
for each row execute function public.set_updated_at();

-- Optional read model for command/control history.
create table if not exists public.device_events (
  id uuid primary key default gen_random_uuid(),
  device_id text not null references public.devices(device_id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_device_events_device_id_created_at
on public.device_events(device_id, created_at desc);
