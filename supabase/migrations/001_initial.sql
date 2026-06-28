-- ============================================================
-- Phase 1: Foundation — Users table
-- ============================================================

create table if not exists public.users (
  id           uuid        primary key default gen_random_uuid(),
  email        text        unique not null,
  password_hash text       not null,
  full_name    text        not null,
  role         text        not null check (role in ('recruiter', 'candidate')),
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Keep updated_at current automatically
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- Row-level security (backend uses service role key and bypasses RLS;
-- enable here for any future direct-from-client queries)
alter table public.users enable row level security;

-- Recruiters and candidates can read their own row
create policy "users_select_own"
  on public.users for select
  using (auth.uid()::text = id::text);

-- Performance indexes
create index if not exists idx_users_email on public.users (email);
create index if not exists idx_users_role  on public.users (role);
