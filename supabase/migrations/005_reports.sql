-- Phase 5: Evaluation Reports

create table if not exists public.reports (
  id                    uuid        primary key default gen_random_uuid(),
  interview_id          uuid        not null unique references public.interviews(id) on delete cascade,
  candidate_id          uuid        not null references public.users(id),
  job_id                uuid        not null references public.job_descriptions(id),
  overall_score         int         check (overall_score between 0 and 100),
  technical_score       int         check (technical_score between 0 and 100),
  communication_score   int         check (communication_score between 0 and 100),
  cultural_fit_score    int         check (cultural_fit_score between 0 and 100),
  summary               text,
  strengths             text[]      default '{}',
  areas_for_improvement text[]      default '{}',
  recommendation        text        check (recommendation in ('Strong Hire','Hire','No Hire')),
  status                text        not null default 'generating' check (status in ('generating','ready','error')),
  created_at            timestamptz not null default now()
);

alter table public.reports enable row level security;

create policy "reports_read" on public.reports for select using (true);

create index if not exists idx_reports_candidate on public.reports(candidate_id);
create index if not exists idx_reports_job       on public.reports(job_id);
