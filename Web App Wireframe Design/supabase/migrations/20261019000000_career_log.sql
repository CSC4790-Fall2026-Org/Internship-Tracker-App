-- Career log: accomplishments, projects, feedback, skills and milestones the user records over time.
-- The Brag Doc view and the AI Career Coach both read from this table.

create table public.career_log_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null default 'accomplishment'
    check (category in ('accomplishment', 'project', 'feedback', 'skill', 'milestone')),
  title text not null check (char_length(trim(title)) > 0),
  details text not null default '',
  -- The result or why it mattered, e.g. "Cut page load from 4s to 1s". Kept apart from details for the brag doc.
  impact text not null default '',
  date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index career_log_entries_user_id_date_idx on public.career_log_entries (user_id, date desc);

create trigger career_log_entries_set_updated_at
before update on public.career_log_entries
for each row execute function public.set_updated_at();

alter table public.career_log_entries enable row level security;

create policy "Users manage own career log entries" on public.career_log_entries
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
