-- Events the user adds themselves. Deadlines, interview stages and task due dates are
-- already stored elsewhere; the calendar reads those directly rather than duplicating them.
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  application_id uuid references public.applications (id) on delete set null,
  title text not null,
  date date not null,
  start_time time,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index calendar_events_user_id_date_idx on public.calendar_events (user_id, date);
create index calendar_events_application_id_idx on public.calendar_events (application_id);

create trigger calendar_events_set_updated_at
before update on public.calendar_events
for each row execute function public.set_updated_at();

alter table public.calendar_events enable row level security;

create policy "Users manage own calendar events" on public.calendar_events
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (application_id is null or exists (
      select 1 from public.applications a where a.id = application_id and a.user_id = (select auth.uid())
    ))
  );
