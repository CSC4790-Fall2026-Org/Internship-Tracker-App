-- AI job recommendations for the Jobs page, one cached set per user.
-- The "jobs" Edge Function builds these from Adzuna listings and the user's resume profile.
-- They're cached because every user shares one Adzuna quota (250 calls/day on the free tier).

create table public.job_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  -- Listings with a match score and a written reason, best first.
  jobs jsonb not null default '[]'::jsonb,
  -- The Adzuna searches that produced them, kept so the page can say what was searched.
  searches jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger job_recommendations_set_updated_at
before update on public.job_recommendations
for each row execute function public.set_updated_at();

alter table public.job_recommendations enable row level security;

create policy "Users manage own job recommendations" on public.job_recommendations
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
