-- A private calendar feed per user, so Google Calendar (or Apple/Outlook) can subscribe to the
-- Calendar page by URL. The token is the only thing guarding the feed, so it is random and can be
-- reset; the calendar-feed Edge Function looks it up with the service role.
create table public.calendar_feeds (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  -- IANA name from the browser (e.g. America/New_York). Event times are stored without a zone,
  -- so the feed needs this to put them at the right hour in Google.
  timezone text not null default 'UTC',
  created_at timestamptz not null default now()
);

alter table public.calendar_feeds enable row level security;

create policy "Users manage own calendar feed" on public.calendar_feeds
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
