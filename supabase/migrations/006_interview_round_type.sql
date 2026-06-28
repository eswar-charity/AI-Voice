-- Separate interview sessions per round (HR → Technical → Manager)

alter table public.interviews
  add column if not exists round_type text not null default 'hr'
  check (round_type in ('hr', 'technical', 'manager'));

create index if not exists idx_interviews_series
  on public.interviews(candidate_id, job_id, match_id, round_type);
