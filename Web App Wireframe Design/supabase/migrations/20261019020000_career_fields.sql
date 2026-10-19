-- The fields someone works in (up to 3), asked during onboarding and editable on Profile.
-- The Jobs page keeps its searches and rankings inside these, so a nursing student isn't shown software roles.

alter table public.resume_profiles
  add column career_fields text[] not null default '{}'
  check (
    cardinality(career_fields) <= 3
    and career_fields <@ array['software', 'engineering', 'data', 'healthcare', 'finance', 'business', 'marketing',
                               'design', 'science', 'education', 'government', 'law', 'media']
  );

-- The fields a saved recommendation set was built for, so changing them can skip the refresh cooldown.
alter table public.job_recommendations
  add column career_fields text[] not null default '{}';
