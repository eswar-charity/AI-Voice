-- Phase 2: Resumes and Job Descriptions

create table if not exists public.resumes (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references public.users(id) on delete cascade,
  file_name       text        not null,
  file_size       int         not null,
  openai_file_id  text,
  parsed_content  jsonb,
  raw_text        text,
  status          text        not null default 'processing' check (status in ('processing','ready','error')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.job_descriptions (
  id               uuid        primary key default gen_random_uuid(),
  recruiter_id     uuid        not null references public.users(id) on delete cascade,
  title            text        not null,
  company          text        not null,
  location         text,
  employment_type  text        default 'full_time' check (employment_type in ('full_time','part_time','contract','internship')),
  description      text        not null,
  requirements     text        not null,
  status           text        not null default 'open' check (status in ('open','closed','draft')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger resumes_updated_at
  before update on public.resumes
  for each row execute function public.set_updated_at();

create trigger jobs_updated_at
  before update on public.job_descriptions
  for each row execute function public.set_updated_at();

alter table public.resumes          enable row level security;
alter table public.job_descriptions enable row level security;

create policy "resumes_own" on public.resumes for all
  using (auth.uid()::text = user_id::text);

create policy "jobs_recruiter_write" on public.job_descriptions for all
  using (auth.uid()::text = recruiter_id::text);

create policy "jobs_anyone_read" on public.job_descriptions for select
  using (status = 'open');

create index if not exists idx_resumes_user   on public.resumes(user_id);
create index if not exists idx_jobs_recruiter on public.job_descriptions(recruiter_id);
create index if not exists idx_jobs_status    on public.job_descriptions(status);
