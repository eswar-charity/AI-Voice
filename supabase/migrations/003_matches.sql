-- Phase 3: AI Resume-JD Matching

create table if not exists public.matches (
  id          uuid        primary key default gen_random_uuid(),
  resume_id   uuid        not null references public.resumes(id) on delete cascade,
  job_id      uuid        not null references public.job_descriptions(id) on delete cascade,
  score       int         not null check (score between 0 and 100),
  reasoning   text,
  strengths   text[]      default '{}',
  weaknesses  text[]      default '{}',
  status      text        not null default 'pending' check (status in ('pending','matched','error')),
  created_at  timestamptz not null default now(),
  unique(resume_id, job_id)
);

alter table public.matches enable row level security;

create policy "matches_read" on public.matches for select
  using (true);

create index if not exists idx_matches_job    on public.matches(job_id, score desc);
create index if not exists idx_matches_resume on public.matches(resume_id);
