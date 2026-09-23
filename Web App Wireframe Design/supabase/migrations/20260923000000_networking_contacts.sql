-- Contacts become people the user knows, not rows owned by one application.
-- A contact can now be linked to any number of applications (e.g. two roles at the same company),
-- or to none at all (someone you want to reach out to).

alter table public.contacts add column notes text not null default '';
alter table public.contacts add column phone text not null default '';

create table public.application_contacts (
  application_id uuid not null references public.applications (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (application_id, contact_id)
);

create index application_contacts_contact_id_idx on public.application_contacts (contact_id);
create index application_contacts_user_id_idx on public.application_contacts (user_id);

alter table public.application_contacts enable row level security;

create policy "Users manage own application contacts" on public.application_contacts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.applications a where a.id = application_id and a.user_id = (select auth.uid()))
    and exists (select 1 from public.contacts c where c.id = contact_id and c.user_id = (select auth.uid()))
  );

-- The old contacts policy checked ownership through the parent application, so it has to go
-- before the column it depends on. Contacts are now owned directly by the user.
drop policy "Users manage own contacts" on public.contacts;

create policy "Users manage own contacts" on public.contacts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- The link now lives in application_contacts. No rows exist yet, so nothing to migrate.
alter table public.contacts drop column application_id;
