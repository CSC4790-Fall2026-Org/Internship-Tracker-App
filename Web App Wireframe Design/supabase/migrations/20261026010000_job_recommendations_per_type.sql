-- Keep one saved recommendation set per job type instead of one per user, so switching the
-- "Looking for" picker on the Jobs page shows the saved set for that type instead of running a new search.

alter table public.job_recommendations
  drop constraint job_recommendations_user_id_key;

alter table public.job_recommendations
  add constraint job_recommendations_user_id_job_type_key unique (user_id, job_type);
