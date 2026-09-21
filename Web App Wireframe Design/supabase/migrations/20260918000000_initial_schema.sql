-- Initial schema for the Internship Tracker app.
-- Every row is owned by a user (user_id defaults to auth.uid()) and protected by RLS.

create type public.app_status as enum ('wishlist', 'applied', 'interviewing', 'offer', 'rejected');

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company text not null,
  position text not null,
  status public.app_status not null default 'wishlist',
  applied_date date,
  deadline date,
  job_url text not null default '',
  location text not null default '',
  salary text not null default '',
  notes text not null default '',
  logo_color text not null default '#3B82F6',
  logo_initials text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.interview_stages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  name text not null,
  date date,
  notes text not null default '',
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  name text not null,
  role text not null default '',
  company text not null default '',
  email text not null default '',
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  application_id uuid references public.applications (id) on delete set null,
  text text not null,
  done boolean not null default false,
  due date,
  created_at timestamptz not null default now()
);

create index applications_user_id_idx on public.applications (user_id);
create index interview_stages_user_id_idx on public.interview_stages (user_id);
create index interview_stages_application_id_idx on public.interview_stages (application_id);
create index contacts_user_id_idx on public.contacts (user_id);
create index contacts_application_id_idx on public.contacts (application_id);
create index tasks_user_id_idx on public.tasks (user_id);
create index tasks_application_id_idx on public.tasks (application_id);

-- Keep applications.updated_at current
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger applications_set_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

-- Row level security: users can only touch their own rows
alter table public.applications enable row level security;
alter table public.interview_stages enable row level security;
alter table public.contacts enable row level security;
alter table public.tasks enable row level security;

create policy "Users manage own applications" on public.applications
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage own interview stages" on public.interview_stages
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.applications a where a.id = application_id and a.user_id = (select auth.uid()))
  );

create policy "Users manage own contacts" on public.contacts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.applications a where a.id = application_id and a.user_id = (select auth.uid()))
  );

create policy "Users manage own tasks" on public.tasks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (application_id is null or exists (select 1 from public.applications a where a.id = application_id and a.user_id = (select auth.uid())))
  );
