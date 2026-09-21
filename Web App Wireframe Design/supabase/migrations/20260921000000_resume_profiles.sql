-- Resume upload + AI-extracted profile.
-- Files live in a private storage bucket; the extracted fields live in resume_profiles.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;

-- Files are stored at "<user id>/<filename>", so the first path segment is the owner.
create policy "Users manage own resume files" on storage.objects
  for all to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);

create table public.resume_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  file_path text,
  file_name text,
  full_name text not null default '',
  email text not null default '',
  phone text not null default '',
  school text not null default '',
  major text not null default '',
  graduation text not null default '',
  summary text not null default '',
  skills text[] not null default '{}',
  interests text[] not null default '{}',
  preferred_locations text[] not null default '{}',
  experience jsonb not null default '[]'::jsonb,
  parsed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger resume_profiles_set_updated_at
before update on public.resume_profiles
for each row execute function public.set_updated_at();

alter table public.resume_profiles enable row level security;

create policy "Users manage own resume profile" on public.resume_profiles
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
