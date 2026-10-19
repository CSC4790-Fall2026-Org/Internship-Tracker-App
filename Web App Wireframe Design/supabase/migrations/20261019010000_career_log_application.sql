-- A career log entry can point at the application it came from, e.g. interview feedback or an offer.
-- Deleting the application keeps the entry; only the link goes.

alter table public.career_log_entries
  add column application_id uuid references public.applications (id) on delete set null;

create index career_log_entries_application_id_idx on public.career_log_entries (application_id);

-- Only allow linking to one of your own applications.
drop policy "Users manage own career log entries" on public.career_log_entries;

create policy "Users manage own career log entries" on public.career_log_entries
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      application_id is null
      or exists (select 1 from public.applications a where a.id = application_id and a.user_id = (select auth.uid()))
    )
  );
