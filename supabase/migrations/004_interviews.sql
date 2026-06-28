-- Phase 4: Interview Sessions

create table if not exists public.interviews (
  id              uuid        primary key default gen_random_uuid(),
  candidate_id    uuid        not null references public.users(id),
  job_id          uuid        not null references public.job_descriptions(id),
  match_id        uuid        references public.matches(id),
  status          text        not null default 'pending' check (status in ('pending','in_progress','completed','cancelled')),
  questions       jsonb       default '[]',
  transcript      jsonb       default '[]',
  activity_log    jsonb       default '[]',
  violation_count int         not null default 0,
  started_at      timestamptz,
  ended_at        timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger interviews_updated_at
  before update on public.interviews
  for each row execute function public.set_updated_at();

alter table public.interviews enable row level security;

create policy "interviews_participant" on public.interviews for all
  using (
    auth.uid()::text = candidate_id::text
    or auth.uid()::text in (
      select recruiter_id::text from public.job_descriptions where id = job_id
    )
  );

create index if not exists idx_interviews_candidate on public.interviews(candidate_id);
create index if not exists idx_interviews_job       on public.interviews(job_id);
create index if not exists idx_interviews_status    on public.interviews(status);
