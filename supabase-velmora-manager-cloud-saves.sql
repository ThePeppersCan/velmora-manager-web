-- Run once in the Supabase SQL Editor for the Repo Company project.
-- Browser code uses only the public publishable key; ownership is enforced here.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'velmora-manager-careers',
  'velmora-manager-careers',
  false,
  8388608,
  array['application/octet-stream', 'text/plain']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.velmora_manager_career_slots (
  user_id uuid not null references auth.users(id) on delete cascade,
  slot smallint not null check (slot between 1 and 5),
  object_path text not null,
  previous_object_path text,
  has_previous boolean not null default false,
  save_schema integer not null default 0,
  save_bytes integer not null default 0 check (save_bytes >= 0),
  checksum text not null,
  save_timestamp timestamptz not null,
  revision bigint not null default 1 check (revision > 0),
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, slot),
  constraint velmora_current_path_owned check (object_path = user_id::text || '/slot-' || slot::text || '.velmora'),
  constraint velmora_previous_path_owned check (previous_object_path is null or previous_object_path = user_id::text || '/slot-' || slot::text || '.previous.velmora')
);

alter table public.velmora_manager_career_slots enable row level security;
revoke all on table public.velmora_manager_career_slots from anon;
grant select, insert, update, delete on table public.velmora_manager_career_slots to authenticated;

drop policy if exists "Velmora players read their career slots" on public.velmora_manager_career_slots;
create policy "Velmora players read their career slots"
on public.velmora_manager_career_slots for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Velmora players create their career slots" on public.velmora_manager_career_slots;
create policy "Velmora players create their career slots"
on public.velmora_manager_career_slots for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Velmora players update their career slots" on public.velmora_manager_career_slots;
create policy "Velmora players update their career slots"
on public.velmora_manager_career_slots for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Velmora players delete their career slots" on public.velmora_manager_career_slots;
create policy "Velmora players delete their career slots"
on public.velmora_manager_career_slots for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Velmora players read their career objects" on storage.objects;
create policy "Velmora players read their career objects"
on storage.objects for select
to authenticated
using (
  bucket_id = 'velmora-manager-careers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Velmora players create their career objects" on storage.objects;
create policy "Velmora players create their career objects"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'velmora-manager-careers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Velmora players update their career objects" on storage.objects;
create policy "Velmora players update their career objects"
on storage.objects for update
to authenticated
using (
  bucket_id = 'velmora-manager-careers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'velmora-manager-careers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Velmora players delete their career objects" on storage.objects;
create policy "Velmora players delete their career objects"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'velmora-manager-careers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
