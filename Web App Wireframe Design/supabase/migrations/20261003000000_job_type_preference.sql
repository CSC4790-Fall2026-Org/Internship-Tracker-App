-- What kind of role the user is looking for. Drives the Jobs page recommendations and the Browse default.
-- 'auto' keeps the original behavior: the AI guesses internship vs. full-time from the graduation date.

alter table public.resume_profiles
  add column job_type text not null default 'auto'
  check (job_type in ('auto', 'internship', 'new_grad', 'full_time', 'part_time'));

-- The job type a saved recommendation set was built for, so changing it can skip the refresh cooldown.
alter table public.job_recommendations
  add column job_type text not null default 'auto';
