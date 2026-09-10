-- =====================================================================
-- Velmora Manager · Online Career (two-manager shared world)
-- Run once in the Supabase SQL Editor for the Repo Company project.
-- Safe to re-run: every statement is idempotent.
--
-- Browser code uses only the public publishable key. Every rule that
-- protects a shared career lives here, not in the client.
--
-- Model
--   careers        one shared world, owned by its members
--   members        who may touch that world, and in what role
--   club_claims    exactly one human manager per club
--   club_state     the per-club partition each manager owns outright
--   events         the ordered, gap-free log that defines the world
--   snapshots      periodic compaction of the log
--   barriers       matchday gates that stop the calendar advancing
--   submissions    per-manager readiness and locked line-ups
--   match_results  one authoritative result per fixture, ever
--   presence       informative only; never authoritative for progress
-- =====================================================================

-- ---------------------------------------------------------------
-- 0. Schema version marker
-- ---------------------------------------------------------------
create table if not exists public.velmora_multiplayer_schema (
  id smallint primary key default 1 check (id = 1),
  schema_version integer not null,
  applied_at timestamptz not null default now()
);
insert into public.velmora_multiplayer_schema (id, schema_version)
values (1, 1)
on conflict (id) do update set schema_version = 1, applied_at = now();

-- ---------------------------------------------------------------
-- 1. Careers
-- ---------------------------------------------------------------
create table if not exists public.velmora_multiplayer_careers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 60),
  privacy text not null default 'INVITE' check (privacy in ('INVITE','PRIVATE')),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  join_code text not null unique check (join_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  password_salt text,
  password_hash text,
  max_members smallint not null default 2 check (max_members between 2 and 2),
  status text not null default 'LOBBY' check (status in ('LOBBY','ACTIVE','ARCHIVED')),
  game_version text not null default '0.0.0',
  save_schema integer not null default 0,
  world_seed text,
  career_date date,
  season_id text,
  -- Monotonic. Equals the seq of the newest event. Never decreases.
  revision bigint not null default 0 check (revision >= 0),
  snapshot_revision bigint not null default 0 check (snapshot_revision >= 0),
  schema_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  archived_at timestamptz
);
create index if not exists velmora_mp_careers_host_idx on public.velmora_multiplayer_careers (host_user_id);

-- ---------------------------------------------------------------
-- 2. Members
-- ---------------------------------------------------------------
create table if not exists public.velmora_multiplayer_members (
  career_id uuid not null references public.velmora_multiplayer_careers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'MANAGER' check (role in ('HOST','MANAGER')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','LEFT','REMOVED','AI_CONTROLLED')),
  display_name text not null default 'Manager',
  ready boolean not null default false,
  client_version text,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (career_id, user_id)
);
create index if not exists velmora_mp_members_user_idx on public.velmora_multiplayer_members (user_id);
-- Exactly one host per career.
create unique index if not exists velmora_mp_members_single_host
  on public.velmora_multiplayer_members (career_id) where role = 'HOST';

-- ---------------------------------------------------------------
-- 3. Manager profiles (per member, per career)
-- ---------------------------------------------------------------
create table if not exists public.velmora_multiplayer_manager_profiles (
  career_id uuid not null references public.velmora_multiplayer_careers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  manager_name text not null default 'Career Manager',
  profile jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (career_id, user_id)
);

-- ---------------------------------------------------------------
-- 3b. Manager-private drawer
--     Shortlists, scouting assignments, unrevealed reports, draft
--     tactics and inbox state. Readable ONLY by the manager it belongs
--     to, so that resuming on another device keeps private work private.
-- ---------------------------------------------------------------
create table if not exists public.velmora_multiplayer_manager_private (
  career_id uuid not null references public.velmora_multiplayer_careers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload text not null default '',
  bytes integer not null default 0 check (bytes >= 0),
  save_schema integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (career_id, user_id)
);

-- ---------------------------------------------------------------
-- 4. Club claims · one human manager per club, one club per manager
-- ---------------------------------------------------------------
create table if not exists public.velmora_multiplayer_club_claims (
  career_id uuid not null references public.velmora_multiplayer_careers(id) on delete cascade,
  club_id text not null check (length(club_id) between 1 and 64),
  user_id uuid not null references auth.users(id) on delete cascade,
  club_name text not null default '',
  custom_club jsonb,
  claimed_at timestamptz not null default now(),
  primary key (career_id, club_id)
);
-- A manager cannot occupy two clubs in the same career.
create unique index if not exists velmora_mp_club_claims_one_per_user
  on public.velmora_multiplayer_club_claims (career_id, user_id);

-- ---------------------------------------------------------------
-- 5. Per-club state partition (owned outright by its claimant)
--    Optimistic concurrency through `revision`; a stale tab cannot
--    overwrite a newer write of the same club.
-- ---------------------------------------------------------------
create table if not exists public.velmora_multiplayer_club_state (
  career_id uuid not null references public.velmora_multiplayer_careers(id) on delete cascade,
  club_id text not null,
  revision bigint not null default 1 check (revision > 0),
  payload jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (career_id, club_id)
);

-- ---------------------------------------------------------------
-- 6. Invitations (audit + rotation; the code itself grants nothing)
-- ---------------------------------------------------------------
create table if not exists public.velmora_multiplayer_invitations (
  id uuid primary key default gen_random_uuid(),
  career_id uuid not null references public.velmora_multiplayer_careers(id) on delete cascade,
  code text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  uses integer not null default 0 check (uses >= 0),
  max_uses integer not null default 1 check (max_uses > 0)
);
create index if not exists velmora_mp_invitations_career_idx on public.velmora_multiplayer_invitations (career_id);

-- ---------------------------------------------------------------
-- 7. Event log · the ordered definition of the shared world
--    idempotency_key  retry safety (same client, same intent)
--    subject_key      exactly-once exclusivity for contested actions
-- ---------------------------------------------------------------
create table if not exists public.velmora_multiplayer_events (
  id bigint generated always as identity primary key,
  career_id uuid not null references public.velmora_multiplayer_careers(id) on delete cascade,
  seq bigint not null check (seq > 0),
  kind text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  club_id text,
  fixture_id text,
  subject_key text,
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists velmora_mp_events_seq
  on public.velmora_multiplayer_events (career_id, seq);
create unique index if not exists velmora_mp_events_idempotency
  on public.velmora_multiplayer_events (career_id, idempotency_key);
create unique index if not exists velmora_mp_events_subject
  on public.velmora_multiplayer_events (career_id, subject_key) where subject_key is not null;
create index if not exists velmora_mp_events_career_seq_idx
  on public.velmora_multiplayer_events (career_id, seq desc);

-- ---------------------------------------------------------------
-- 8. World snapshots · compaction of the log
-- ---------------------------------------------------------------
create table if not exists public.velmora_multiplayer_world_snapshots (
  career_id uuid not null references public.velmora_multiplayer_careers(id) on delete cascade,
  revision bigint not null check (revision >= 0),
  payload text not null,
  bytes integer not null default 0 check (bytes >= 0),
  checksum text not null default '',
  save_schema integer not null default 0,
  career_date date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (career_id, revision)
);

-- ---------------------------------------------------------------
-- 9. Matchday barriers
-- ---------------------------------------------------------------
create table if not exists public.velmora_multiplayer_matchday_barriers (
  career_id uuid not null references public.velmora_multiplayer_careers(id) on delete cascade,
  career_date date not null,
  status text not null default 'OPEN' check (status in ('OPEN','RESOLVED')),
  -- [{user_id, club_id, fixture_id, opponent_club_id, human_vs_human}]
  required jsonb not null default '[]'::jsonb,
  opened_by uuid references auth.users(id) on delete set null,
  opened_at timestamptz not null default now(),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  resolution_seq bigint,
  next_date date,
  primary key (career_id, career_date)
);

-- ---------------------------------------------------------------
-- 10. Match submissions (readiness + locked line-ups)
-- ---------------------------------------------------------------
create table if not exists public.velmora_multiplayer_match_submissions (
  career_id uuid not null references public.velmora_multiplayer_careers(id) on delete cascade,
  fixture_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  club_id text not null,
  career_date date,
  state text not null default 'PREPARING' check (state in ('PREPARING','READY','PLAYING','COMPLETED')),
  lineup jsonb not null default '{}'::jsonb,
  tactics jsonb not null default '{}'::jsonb,
  locked_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (career_id, fixture_id, user_id)
);
create index if not exists velmora_mp_submissions_date_idx
  on public.velmora_multiplayer_match_submissions (career_id, career_date);

-- ---------------------------------------------------------------
-- 11. Authoritative match results · one row per fixture, ever
-- ---------------------------------------------------------------
create table if not exists public.velmora_multiplayer_match_results (
  career_id uuid not null references public.velmora_multiplayer_careers(id) on delete cascade,
  fixture_id text not null,
  career_date date,
  home_club_id text,
  away_club_id text,
  home_score integer not null default 0 check (home_score >= 0),
  away_score integer not null default 0 check (away_score >= 0),
  result jsonb not null default '{}'::jsonb,
  resolved_by uuid references auth.users(id) on delete set null,
  resolution_mode text not null default 'QUICK_SIM',
  event_seq bigint,
  created_at timestamptz not null default now(),
  primary key (career_id, fixture_id)
);

-- ---------------------------------------------------------------
-- 12. Presence (informative only)
-- ---------------------------------------------------------------
create table if not exists public.velmora_multiplayer_presence (
  career_id uuid not null references public.velmora_multiplayer_careers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'ONLINE' check (status in ('ONLINE','AWAY','OFFLINE')),
  activity text not null default 'Menus',
  client_id text,
  last_seen_at timestamptz not null default now(),
  primary key (career_id, user_id)
);

-- ---------------------------------------------------------------
-- 13. Audit trail
-- ---------------------------------------------------------------
create table if not exists public.velmora_multiplayer_audit (
  id bigint generated always as identity primary key,
  career_id uuid not null references public.velmora_multiplayer_careers(id) on delete cascade,
  action text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists velmora_mp_audit_career_idx on public.velmora_multiplayer_audit (career_id, created_at desc);

-- =====================================================================
-- 14. Membership helpers
--     SECURITY DEFINER so that policies on `members` can reference
--     membership without recursing into their own RLS.
-- =====================================================================
create or replace function public.velmora_mp_is_member(p_career_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.velmora_multiplayer_members m
    where m.career_id = p_career_id
      and m.user_id = auth.uid()
      and m.status in ('ACTIVE','AI_CONTROLLED')
  );
$$;

create or replace function public.velmora_mp_is_active_member(p_career_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.velmora_multiplayer_members m
    where m.career_id = p_career_id and m.user_id = auth.uid() and m.status = 'ACTIVE'
  );
$$;

create or replace function public.velmora_mp_is_host(p_career_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.velmora_multiplayer_members m
    where m.career_id = p_career_id and m.user_id = auth.uid()
      and m.role = 'HOST' and m.status = 'ACTIVE'
  );
$$;

create or replace function public.velmora_mp_owns_club(p_career_id uuid, p_club_id text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.velmora_multiplayer_club_claims c
    where c.career_id = p_career_id and c.club_id = p_club_id and c.user_id = auth.uid()
  );
$$;

create or replace function public.velmora_mp_hash_password(p_salt text, p_password text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select case
    when p_password is null or length(p_password) = 0 then null
    else encode(sha256(convert_to(coalesce(p_salt,'') || '::' || p_password, 'utf8')), 'hex')
  end;
$$;

-- Short, readable, unambiguous. No I, O, 0, 1.
create or replace function public.velmora_mp_new_join_code()
returns text language plpgsql volatile set search_path = public, pg_temp as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  attempt integer := 0;
begin
  loop
    attempt := attempt + 1;
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.velmora_multiplayer_careers c where c.join_code = candidate);
    if attempt > 40 then
      raise exception 'VELMORA_CODE_EXHAUSTED' using errcode = '55000';
    end if;
  end loop;
  return candidate;
end;
$$;

-- =====================================================================
-- 15. Row Level Security
--     Careers are readable only by their members. Nothing in this file
--     lets an invitation code read the database directly; joining goes
--     through velmora_mp_join_career() and nothing else.
-- =====================================================================
alter table public.velmora_multiplayer_careers            enable row level security;
alter table public.velmora_multiplayer_members            enable row level security;
alter table public.velmora_multiplayer_manager_profiles   enable row level security;
alter table public.velmora_multiplayer_manager_private    enable row level security;
alter table public.velmora_multiplayer_club_claims        enable row level security;
alter table public.velmora_multiplayer_club_state         enable row level security;
alter table public.velmora_multiplayer_invitations        enable row level security;
alter table public.velmora_multiplayer_events             enable row level security;
alter table public.velmora_multiplayer_world_snapshots    enable row level security;
alter table public.velmora_multiplayer_matchday_barriers  enable row level security;
alter table public.velmora_multiplayer_match_submissions  enable row level security;
alter table public.velmora_multiplayer_match_results      enable row level security;
alter table public.velmora_multiplayer_presence           enable row level security;
alter table public.velmora_multiplayer_audit              enable row level security;
alter table public.velmora_multiplayer_schema             enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'velmora_multiplayer_careers','velmora_multiplayer_members','velmora_multiplayer_manager_profiles',
    'velmora_multiplayer_manager_private',
    'velmora_multiplayer_club_claims','velmora_multiplayer_club_state','velmora_multiplayer_invitations',
    'velmora_multiplayer_events','velmora_multiplayer_world_snapshots','velmora_multiplayer_matchday_barriers',
    'velmora_multiplayer_match_submissions','velmora_multiplayer_match_results','velmora_multiplayer_presence',
    'velmora_multiplayer_audit','velmora_multiplayer_schema'
  ] loop
    execute format('revoke all on table public.%I from anon', t);
    execute format('grant select on table public.%I to authenticated', t);
  end loop;
end $$;

-- Writes that need cross-row invariants go through RPCs only. The direct
-- grants below are deliberately narrow.
grant insert, update on table public.velmora_multiplayer_presence to authenticated;
grant insert, update on table public.velmora_multiplayer_match_submissions to authenticated;
grant update on table public.velmora_multiplayer_manager_profiles to authenticated;
grant insert on table public.velmora_multiplayer_manager_profiles to authenticated;

-- ---- careers ----
drop policy if exists "mp members read their careers" on public.velmora_multiplayer_careers;
create policy "mp members read their careers" on public.velmora_multiplayer_careers
  for select to authenticated using (public.velmora_mp_is_member(id));

-- ---- members ----
drop policy if exists "mp members read the roster" on public.velmora_multiplayer_members;
create policy "mp members read the roster" on public.velmora_multiplayer_members
  for select to authenticated using (public.velmora_mp_is_member(career_id));

-- ---- manager profiles ----
drop policy if exists "mp members read manager profiles" on public.velmora_multiplayer_manager_profiles;
create policy "mp members read manager profiles" on public.velmora_multiplayer_manager_profiles
  for select to authenticated using (public.velmora_mp_is_member(career_id));

drop policy if exists "mp managers write their own profile" on public.velmora_multiplayer_manager_profiles;
create policy "mp managers write their own profile" on public.velmora_multiplayer_manager_profiles
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.velmora_mp_is_active_member(career_id));

drop policy if exists "mp managers update their own profile" on public.velmora_multiplayer_manager_profiles;
create policy "mp managers update their own profile" on public.velmora_multiplayer_manager_profiles
  for update to authenticated
  using (user_id = (select auth.uid()) and public.velmora_mp_is_active_member(career_id))
  with check (user_id = (select auth.uid()));

-- ---- manager private drawer ----
-- No policy grants another member sight of this table, by design.
drop policy if exists "mp managers read only their own drawer" on public.velmora_multiplayer_manager_private;
create policy "mp managers read only their own drawer" on public.velmora_multiplayer_manager_private
  for select to authenticated using (user_id = (select auth.uid()));

-- ---- club claims ----
drop policy if exists "mp members read club claims" on public.velmora_multiplayer_club_claims;
create policy "mp members read club claims" on public.velmora_multiplayer_club_claims
  for select to authenticated using (public.velmora_mp_is_member(career_id));

-- ---- club state ----
drop policy if exists "mp members read club state" on public.velmora_multiplayer_club_state;
create policy "mp members read club state" on public.velmora_multiplayer_club_state
  for select to authenticated using (public.velmora_mp_is_member(career_id));

-- ---- invitations ----
drop policy if exists "mp host reads invitations" on public.velmora_multiplayer_invitations;
create policy "mp host reads invitations" on public.velmora_multiplayer_invitations
  for select to authenticated using (public.velmora_mp_is_host(career_id));

-- ---- events ----
drop policy if exists "mp members read events" on public.velmora_multiplayer_events;
create policy "mp members read events" on public.velmora_multiplayer_events
  for select to authenticated using (public.velmora_mp_is_member(career_id));

-- ---- snapshots ----
drop policy if exists "mp members read snapshots" on public.velmora_multiplayer_world_snapshots;
create policy "mp members read snapshots" on public.velmora_multiplayer_world_snapshots
  for select to authenticated using (public.velmora_mp_is_member(career_id));

-- ---- barriers ----
drop policy if exists "mp members read barriers" on public.velmora_multiplayer_matchday_barriers;
create policy "mp members read barriers" on public.velmora_multiplayer_matchday_barriers
  for select to authenticated using (public.velmora_mp_is_member(career_id));

-- ---- submissions ----
-- Readable by both managers (readiness must be visible), but only the
-- owning manager may write, and only for a club they actually hold.
drop policy if exists "mp members read submissions" on public.velmora_multiplayer_match_submissions;
create policy "mp members read submissions" on public.velmora_multiplayer_match_submissions
  for select to authenticated using (public.velmora_mp_is_member(career_id));

drop policy if exists "mp managers insert their submission" on public.velmora_multiplayer_match_submissions;
create policy "mp managers insert their submission" on public.velmora_multiplayer_match_submissions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.velmora_mp_is_active_member(career_id)
    and public.velmora_mp_owns_club(career_id, club_id)
  );

drop policy if exists "mp managers update their submission" on public.velmora_multiplayer_match_submissions;
create policy "mp managers update their submission" on public.velmora_multiplayer_match_submissions
  for update to authenticated
  using (user_id = (select auth.uid()) and public.velmora_mp_is_active_member(career_id))
  with check (user_id = (select auth.uid()) and public.velmora_mp_owns_club(career_id, club_id));

-- ---- match results ----
drop policy if exists "mp members read results" on public.velmora_multiplayer_match_results;
create policy "mp members read results" on public.velmora_multiplayer_match_results
  for select to authenticated using (public.velmora_mp_is_member(career_id));

-- ---- presence ----
drop policy if exists "mp members read presence" on public.velmora_multiplayer_presence;
create policy "mp members read presence" on public.velmora_multiplayer_presence
  for select to authenticated using (public.velmora_mp_is_member(career_id));

drop policy if exists "mp managers write their presence" on public.velmora_multiplayer_presence;
create policy "mp managers write their presence" on public.velmora_multiplayer_presence
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.velmora_mp_is_member(career_id));

drop policy if exists "mp managers update their presence" on public.velmora_multiplayer_presence;
create policy "mp managers update their presence" on public.velmora_multiplayer_presence
  for update to authenticated
  using (user_id = (select auth.uid()) and public.velmora_mp_is_member(career_id))
  with check (user_id = (select auth.uid()));

-- ---- audit ----
drop policy if exists "mp members read audit" on public.velmora_multiplayer_audit;
create policy "mp members read audit" on public.velmora_multiplayer_audit
  for select to authenticated using (public.velmora_mp_is_member(career_id));

-- ---- schema marker ----
drop policy if exists "mp schema readable" on public.velmora_multiplayer_schema;
create policy "mp schema readable" on public.velmora_multiplayer_schema
  for select to authenticated using (true);

-- =====================================================================
-- 16. Remote procedures
--     Everything that needs a cross-row invariant lives here so that it
--     runs inside one transaction. Errors are raised with a stable
--     VELMORA_* prefix the client maps to player-facing language; raw
--     database text is never shown to a player.
-- =====================================================================

-- ---- create ----------------------------------------------------------
create or replace function public.velmora_mp_create_career(
  p_name text,
  p_privacy text default 'INVITE',
  p_password text default null,
  p_game_version text default '0.0.0',
  p_save_schema integer default 0,
  p_display_name text default 'Manager'
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_salt text;
  v_career public.velmora_multiplayer_careers;
begin
  if v_uid is null then raise exception 'VELMORA_NOT_SIGNED_IN' using errcode = '42501'; end if;
  if p_name is null or length(btrim(p_name)) = 0 then raise exception 'VELMORA_NAME_REQUIRED' using errcode = '22023'; end if;

  v_code := public.velmora_mp_new_join_code();
  -- Core functions only: no pgcrypto dependency for a fresh project.
  v_salt := md5(gen_random_uuid()::text || clock_timestamp()::text);

  insert into public.velmora_multiplayer_careers
    (name, privacy, host_user_id, join_code, password_salt, password_hash, game_version, save_schema)
  values
    (btrim(p_name),
     case when upper(coalesce(p_privacy,'INVITE')) = 'PRIVATE' then 'PRIVATE' else 'INVITE' end,
     v_uid, v_code, v_salt, public.velmora_mp_hash_password(v_salt, nullif(btrim(coalesce(p_password,'')),'')),
     coalesce(p_game_version,'0.0.0'), coalesce(p_save_schema,0))
  returning * into v_career;

  insert into public.velmora_multiplayer_members (career_id, user_id, role, display_name, client_version)
  values (v_career.id, v_uid, 'HOST', coalesce(nullif(btrim(p_display_name),''),'Manager'), p_game_version);

  insert into public.velmora_multiplayer_invitations (career_id, code, created_by, max_uses)
  values (v_career.id, v_code, v_uid, 1);

  insert into public.velmora_multiplayer_audit (career_id, action, actor_user_id, detail)
  values (v_career.id, 'CAREER_CREATED', v_uid, jsonb_build_object('name', v_career.name, 'privacy', v_career.privacy));

  return jsonb_build_object(
    'career_id', v_career.id, 'name', v_career.name, 'join_code', v_career.join_code,
    'privacy', v_career.privacy, 'status', v_career.status, 'revision', v_career.revision,
    'max_members', v_career.max_members, 'game_version', v_career.game_version,
    'requires_password', v_career.password_hash is not null
  );
end;
$$;

-- ---- preview (pre-join; deliberately minimal) -------------------------
create or replace function public.velmora_mp_preview_career(p_code text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_career public.velmora_multiplayer_careers;
  v_host text;
  v_members integer;
begin
  if v_uid is null then raise exception 'VELMORA_NOT_SIGNED_IN' using errcode = '42501'; end if;
  select * into v_career from public.velmora_multiplayer_careers
   where join_code = upper(btrim(coalesce(p_code,'')));
  if not found then raise exception 'VELMORA_CODE_UNKNOWN' using errcode = 'P0002'; end if;
  if v_career.status = 'ARCHIVED' then raise exception 'VELMORA_CAREER_ARCHIVED' using errcode = 'P0002'; end if;

  select display_name into v_host from public.velmora_multiplayer_members
   where career_id = v_career.id and role = 'HOST';
  select count(*) into v_members from public.velmora_multiplayer_members
   where career_id = v_career.id and status = 'ACTIVE';

  return jsonb_build_object(
    'career_id', v_career.id,
    'name', v_career.name,
    'host_name', coalesce(v_host, 'Host'),
    'status', v_career.status,
    'members', v_members,
    'max_members', v_career.max_members,
    'game_version', v_career.game_version,
    'save_schema', v_career.save_schema,
    'career_date', v_career.career_date,
    'season_id', v_career.season_id,
    'requires_password', v_career.password_hash is not null,
    'already_member', exists (select 1 from public.velmora_multiplayer_members m
                                where m.career_id = v_career.id and m.user_id = v_uid and m.status in ('ACTIVE','AI_CONTROLLED')),
    'claimed_club_ids', coalesce((select jsonb_agg(club_id) from public.velmora_multiplayer_club_claims
                                   where career_id = v_career.id), '[]'::jsonb)
  );
end;
$$;

-- ---- join ------------------------------------------------------------
create or replace function public.velmora_mp_join_career(
  p_code text,
  p_password text default null,
  p_display_name text default 'Manager',
  p_client_version text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_career public.velmora_multiplayer_careers;
  v_active integer;
begin
  if v_uid is null then raise exception 'VELMORA_NOT_SIGNED_IN' using errcode = '42501'; end if;

  select * into v_career from public.velmora_multiplayer_careers
   where join_code = upper(btrim(coalesce(p_code,''))) for update;
  if not found then raise exception 'VELMORA_CODE_UNKNOWN' using errcode = 'P0002'; end if;
  if v_career.status = 'ARCHIVED' then raise exception 'VELMORA_CAREER_ARCHIVED' using errcode = 'P0002'; end if;

  if v_career.password_hash is not null
     and v_career.password_hash is distinct from public.velmora_mp_hash_password(v_career.password_salt, coalesce(p_password,'')) then
    raise exception 'VELMORA_BAD_PASSWORD' using errcode = '42501';
  end if;

  -- Rejoining is always allowed and never consumes a seat.
  if exists (select 1 from public.velmora_multiplayer_members
              where career_id = v_career.id and user_id = v_uid and status in ('ACTIVE','AI_CONTROLLED')) then
    update public.velmora_multiplayer_members
       set last_seen_at = now(), client_version = coalesce(p_client_version, client_version), updated_at = now()
     where career_id = v_career.id and user_id = v_uid;
    return jsonb_build_object('career_id', v_career.id, 'rejoined', true, 'status', v_career.status);
  end if;

  select count(*) into v_active from public.velmora_multiplayer_members
   where career_id = v_career.id and status = 'ACTIVE';
  if v_active >= v_career.max_members then
    raise exception 'VELMORA_CAREER_FULL' using errcode = '23505';
  end if;

  insert into public.velmora_multiplayer_members (career_id, user_id, role, display_name, client_version)
  values (v_career.id, v_uid, 'MANAGER', coalesce(nullif(btrim(p_display_name),''),'Manager'), p_client_version)
  on conflict (career_id, user_id) do update
    set status = 'ACTIVE', display_name = excluded.display_name,
        client_version = excluded.client_version, updated_at = now(), last_seen_at = now();

  update public.velmora_multiplayer_invitations
     set uses = uses + 1
   where career_id = v_career.id and code = v_career.join_code and revoked_at is null;

  insert into public.velmora_multiplayer_audit (career_id, action, actor_user_id, detail)
  values (v_career.id, 'MEMBER_JOINED', v_uid, jsonb_build_object('display_name', p_display_name));

  return jsonb_build_object('career_id', v_career.id, 'rejoined', false, 'status', v_career.status);
end;
$$;

-- ---- claim a club ----------------------------------------------------
create or replace function public.velmora_mp_claim_club(
  p_career_id uuid,
  p_club_id text,
  p_club_name text default '',
  p_custom_club jsonb default null,
  p_manager_name text default 'Career Manager',
  p_manager_profile jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
begin
  if v_uid is null then raise exception 'VELMORA_NOT_SIGNED_IN' using errcode = '42501'; end if;
  if not public.velmora_mp_is_active_member(p_career_id) then
    raise exception 'VELMORA_NOT_A_MEMBER' using errcode = '42501';
  end if;
  if p_club_id is null or length(btrim(p_club_id)) = 0 then
    raise exception 'VELMORA_CLUB_REQUIRED' using errcode = '22023';
  end if;

  -- Serialise every claim in this career against every other.
  perform 1 from public.velmora_multiplayer_careers where id = p_career_id for update;

  select user_id into v_owner from public.velmora_multiplayer_club_claims
   where career_id = p_career_id and club_id = p_club_id;
  if found and v_owner <> v_uid then
    raise exception 'VELMORA_CLUB_TAKEN' using errcode = '23505';
  end if;

  -- Moving club releases the previous one in the same transaction.
  delete from public.velmora_multiplayer_club_claims
   where career_id = p_career_id and user_id = v_uid and club_id <> p_club_id;

  insert into public.velmora_multiplayer_club_claims (career_id, club_id, user_id, club_name, custom_club)
  values (p_career_id, p_club_id, v_uid, coalesce(p_club_name,''), p_custom_club)
  on conflict (career_id, club_id) do update
    set club_name = excluded.club_name, custom_club = excluded.custom_club;

  insert into public.velmora_multiplayer_manager_profiles (career_id, user_id, manager_name, profile)
  values (p_career_id, v_uid, coalesce(nullif(btrim(p_manager_name),''),'Career Manager'), coalesce(p_manager_profile,'{}'::jsonb))
  on conflict (career_id, user_id) do update
    set manager_name = excluded.manager_name, profile = excluded.profile, updated_at = now();

  insert into public.velmora_multiplayer_audit (career_id, action, actor_user_id, detail)
  values (p_career_id, 'CLUB_CLAIMED', v_uid, jsonb_build_object('club_id', p_club_id, 'club_name', p_club_name));

  return jsonb_build_object('career_id', p_career_id, 'club_id', p_club_id, 'user_id', v_uid);
end;
$$;

create or replace function public.velmora_mp_release_club(p_career_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_club text;
begin
  if not public.velmora_mp_is_active_member(p_career_id) then
    raise exception 'VELMORA_NOT_A_MEMBER' using errcode = '42501';
  end if;
  delete from public.velmora_multiplayer_club_claims
   where career_id = p_career_id and user_id = v_uid returning club_id into v_club;
  update public.velmora_multiplayer_members set ready = false, updated_at = now()
   where career_id = p_career_id and user_id = v_uid;
  return jsonb_build_object('released_club_id', v_club);
end;
$$;

create or replace function public.velmora_mp_set_ready(p_career_id uuid, p_ready boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if not public.velmora_mp_is_active_member(p_career_id) then
    raise exception 'VELMORA_NOT_A_MEMBER' using errcode = '42501';
  end if;
  if p_ready and not exists (select 1 from public.velmora_multiplayer_club_claims
                              where career_id = p_career_id and user_id = v_uid) then
    raise exception 'VELMORA_CLUB_REQUIRED' using errcode = '22023';
  end if;
  update public.velmora_multiplayer_members
     set ready = coalesce(p_ready,false), updated_at = now(), last_seen_at = now()
   where career_id = p_career_id and user_id = v_uid;
  return jsonb_build_object('ready', coalesce(p_ready,false));
end;
$$;

-- ---- append one event ------------------------------------------------
-- Ordering: the career row is locked, so `seq` is gap-free and total.
-- Retry safety: same idempotency_key returns the original event.
-- Exclusivity: a non-null subject_key can only ever be claimed once.
create or replace function public.velmora_mp_append_event(
  p_career_id uuid,
  p_kind text,
  p_payload jsonb default '{}'::jsonb,
  p_idempotency_key text default null,
  p_subject_key text default null,
  p_club_id text default null,
  p_fixture_id text default null,
  p_expect_revision bigint default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_career public.velmora_multiplayer_careers;
  v_event public.velmora_multiplayer_events;
  v_seq bigint;
  v_key text := coalesce(nullif(btrim(coalesce(p_idempotency_key,'')),''), gen_random_uuid()::text);
begin
  if not public.velmora_mp_is_active_member(p_career_id) then
    raise exception 'VELMORA_NOT_A_MEMBER' using errcode = '42501';
  end if;

  select * into v_event from public.velmora_multiplayer_events
   where career_id = p_career_id and idempotency_key = v_key;
  if found then
    return jsonb_build_object('seq', v_event.seq, 'kind', v_event.kind, 'replayed', true,
                              'payload', v_event.payload, 'subject_key', v_event.subject_key);
  end if;

  select * into v_career from public.velmora_multiplayer_careers where id = p_career_id for update;
  if not found then raise exception 'VELMORA_CAREER_UNKNOWN' using errcode = 'P0002'; end if;
  if v_career.status = 'ARCHIVED' then raise exception 'VELMORA_CAREER_ARCHIVED' using errcode = '42501'; end if;

  if p_expect_revision is not null and p_expect_revision <> v_career.revision then
    raise exception 'VELMORA_STALE_REVISION:%', v_career.revision using errcode = '40001';
  end if;

  if p_subject_key is not null
     and exists (select 1 from public.velmora_multiplayer_events
                  where career_id = p_career_id and subject_key = p_subject_key) then
    raise exception 'VELMORA_SUBJECT_TAKEN:%', p_subject_key using errcode = '23505';
  end if;

  update public.velmora_multiplayer_careers
     set revision = revision + 1, updated_at = now()
   where id = p_career_id
   returning revision into v_seq;

  insert into public.velmora_multiplayer_events
    (career_id, seq, kind, actor_user_id, club_id, fixture_id, subject_key, idempotency_key, payload)
  values
    (p_career_id, v_seq, p_kind, v_uid, p_club_id, p_fixture_id, p_subject_key, v_key, coalesce(p_payload,'{}'::jsonb))
  returning * into v_event;

  return jsonb_build_object('seq', v_event.seq, 'kind', v_event.kind, 'replayed', false,
                            'payload', v_event.payload, 'subject_key', v_event.subject_key,
                            'revision', v_seq);
end;
$$;

-- ---- publish this manager's own club partition -----------------------
-- Optimistic concurrency: p_expect_revision must match what the caller
-- last read, so a stale tab can never clobber a newer write of its own
-- club, and no manager can write a club they do not hold.
create or replace function public.velmora_mp_publish_club_state(
  p_career_id uuid,
  p_club_id text,
  p_payload jsonb,
  p_expect_revision bigint default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_current bigint;
  v_next bigint;
begin
  if not public.velmora_mp_is_active_member(p_career_id) then
    raise exception 'VELMORA_NOT_A_MEMBER' using errcode = '42501';
  end if;
  if not public.velmora_mp_owns_club(p_career_id, p_club_id) then
    raise exception 'VELMORA_NOT_YOUR_CLUB' using errcode = '42501';
  end if;

  select revision into v_current from public.velmora_multiplayer_club_state
   where career_id = p_career_id and club_id = p_club_id for update;

  if not found then
    if p_expect_revision is not null and p_expect_revision <> 0 then
      raise exception 'VELMORA_STALE_CLUB_STATE:0' using errcode = '40001';
    end if;
    insert into public.velmora_multiplayer_club_state (career_id, club_id, revision, payload, updated_by)
    values (p_career_id, p_club_id, 1, coalesce(p_payload,'{}'::jsonb), v_uid);
    v_next := 1;
  else
    if p_expect_revision is not null and p_expect_revision <> v_current then
      raise exception 'VELMORA_STALE_CLUB_STATE:%', v_current using errcode = '40001';
    end if;
    update public.velmora_multiplayer_club_state
       set revision = revision + 1, payload = coalesce(p_payload,'{}'::jsonb),
           updated_by = v_uid, updated_at = now()
     where career_id = p_career_id and club_id = p_club_id
     returning revision into v_next;
  end if;

  perform public.velmora_mp_append_event(
    p_career_id, 'CLUB_STATE',
    jsonb_build_object('club_id', p_club_id, 'club_revision', v_next),
    'club:' || p_club_id || ':' || v_next::text,
    null, p_club_id, null, null);

  update public.velmora_multiplayer_members
     set last_seen_at = now() where career_id = p_career_id and user_id = v_uid;

  return jsonb_build_object('club_id', p_club_id, 'revision', v_next);
end;
$$;

-- ---- start the career ------------------------------------------------
create or replace function public.velmora_mp_start_career(
  p_career_id uuid,
  p_world_seed text,
  p_career_date date,
  p_season_id text,
  p_snapshot text,
  p_checksum text default '',
  p_save_schema integer default 0
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_career public.velmora_multiplayer_careers;
  v_unready integer;
begin
  if not public.velmora_mp_is_host(p_career_id) then
    raise exception 'VELMORA_HOST_ONLY' using errcode = '42501';
  end if;

  select * into v_career from public.velmora_multiplayer_careers where id = p_career_id for update;
  if v_career.status = 'ACTIVE' then
    return jsonb_build_object('career_id', p_career_id, 'status', 'ACTIVE', 'already_started', true,
                              'revision', v_career.revision);
  end if;
  if v_career.status = 'ARCHIVED' then raise exception 'VELMORA_CAREER_ARCHIVED' using errcode = '42501'; end if;

  select count(*) into v_unready from public.velmora_multiplayer_members m
   where m.career_id = p_career_id and m.status = 'ACTIVE'
     and (m.ready = false
          or not exists (select 1 from public.velmora_multiplayer_club_claims c
                          where c.career_id = p_career_id and c.user_id = m.user_id));
  if v_unready > 0 then raise exception 'VELMORA_MANAGERS_NOT_READY' using errcode = '22023'; end if;

  update public.velmora_multiplayer_careers
     set status = 'ACTIVE', world_seed = p_world_seed, career_date = p_career_date,
         season_id = p_season_id, save_schema = coalesce(p_save_schema, save_schema),
         started_at = now(), updated_at = now()
   where id = p_career_id
   returning * into v_career;

  insert into public.velmora_multiplayer_world_snapshots
    (career_id, revision, payload, bytes, checksum, save_schema, career_date, created_by)
  values (p_career_id, v_career.revision, p_snapshot, length(coalesce(p_snapshot,'')),
          coalesce(p_checksum,''), coalesce(p_save_schema,0), p_career_date, v_uid)
  on conflict (career_id, revision) do nothing;

  update public.velmora_multiplayer_careers
     set snapshot_revision = greatest(snapshot_revision, v_career.revision) where id = p_career_id;

  perform public.velmora_mp_append_event(
    p_career_id, 'CAREER_STARTED',
    jsonb_build_object('world_seed', p_world_seed, 'career_date', p_career_date, 'season_id', p_season_id),
    'career-started:' || p_career_id::text, 'CAREER_STARTED', null, null, null);

  insert into public.velmora_multiplayer_audit (career_id, action, actor_user_id, detail)
  values (p_career_id, 'CAREER_STARTED', v_uid, jsonb_build_object('career_date', p_career_date));

  return jsonb_build_object('career_id', p_career_id, 'status', 'ACTIVE', 'already_started', false,
                            'revision', v_career.revision);
end;
$$;

-- ---- snapshot compaction --------------------------------------------
create or replace function public.velmora_mp_write_snapshot(
  p_career_id uuid,
  p_revision bigint,
  p_snapshot text,
  p_checksum text default '',
  p_save_schema integer default 0,
  p_career_date date default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_career public.velmora_multiplayer_careers;
begin
  if not public.velmora_mp_is_active_member(p_career_id) then
    raise exception 'VELMORA_NOT_A_MEMBER' using errcode = '42501';
  end if;
  select * into v_career from public.velmora_multiplayer_careers where id = p_career_id for update;

  -- A snapshot may only ever describe a revision the log has reached, and
  -- may never move the compaction pointer backwards.
  if p_revision > v_career.revision then
    raise exception 'VELMORA_SNAPSHOT_AHEAD:%', v_career.revision using errcode = '40001';
  end if;
  if p_revision <= v_career.snapshot_revision then
    return jsonb_build_object('written', false, 'snapshot_revision', v_career.snapshot_revision);
  end if;

  insert into public.velmora_multiplayer_world_snapshots
    (career_id, revision, payload, bytes, checksum, save_schema, career_date, created_by)
  values (p_career_id, p_revision, p_snapshot, length(coalesce(p_snapshot,'')), coalesce(p_checksum,''),
          coalesce(p_save_schema,0), p_career_date, v_uid)
  on conflict (career_id, revision) do nothing;

  update public.velmora_multiplayer_careers
     set snapshot_revision = p_revision,
         career_date = coalesce(p_career_date, career_date),
         updated_at = now()
   where id = p_career_id;

  -- Keep the three newest snapshots as recovery copies.
  delete from public.velmora_multiplayer_world_snapshots s
   where s.career_id = p_career_id
     and s.revision not in (
       select revision from public.velmora_multiplayer_world_snapshots
        where career_id = p_career_id order by revision desc limit 3);

  return jsonb_build_object('written', true, 'snapshot_revision', p_revision);
end;
$$;

-- =====================================================================
-- 17. Shared-day barrier
--     A barrier names every human-controlled club with an unplayed fixture
--     on that date and may also carry one DAY_ADVANCE confirmation per active
--     manager. Byes and blank dates have no fixture requirement, but the
--     deliberate Advance handshake still applies.
-- =====================================================================
create or replace function public.velmora_mp_open_barrier(
  p_career_id uuid,
  p_career_date date,
  p_required jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_barrier public.velmora_multiplayer_matchday_barriers;
  v_clean jsonb := '[]'::jsonb;
  v_row jsonb;
begin
  if not public.velmora_mp_is_active_member(p_career_id) then
    raise exception 'VELMORA_NOT_A_MEMBER' using errcode = '42501';
  end if;

  perform 1 from public.velmora_multiplayer_careers where id = p_career_id for update;

  select * into v_barrier from public.velmora_multiplayer_matchday_barriers
   where career_id = p_career_id and career_date = p_career_date;
  if found then
    return jsonb_build_object('career_date', v_barrier.career_date, 'status', v_barrier.status,
                              'required', v_barrier.required, 'created', false);
  end if;

  -- Only entries that name a real active member holding that real club
  -- survive. A client cannot invent a blocker, nor drop a genuine one and
  -- have the resolver accept it, because resolution re-derives from here.
  for v_row in select * from jsonb_array_elements(coalesce(p_required,'[]'::jsonb)) loop
    if exists (
      select 1
        from public.velmora_multiplayer_club_claims c
        join public.velmora_multiplayer_members m
          on m.career_id = c.career_id and m.user_id = c.user_id
       where c.career_id = p_career_id
         and c.club_id = (v_row->>'club_id')
         and c.user_id = (v_row->>'user_id')::uuid
         and m.status = 'ACTIVE'
    ) and coalesce(nullif(v_row->>'fixture_id',''), null) is not null then
      v_clean := v_clean || jsonb_build_array(v_row);
    end if;
  end loop;

  insert into public.velmora_multiplayer_matchday_barriers
    (career_id, career_date, status, required, opened_by)
  values (p_career_id, p_career_date, 'OPEN', v_clean, v_uid)
  on conflict (career_id, career_date) do nothing
  returning * into v_barrier;

  if v_barrier.career_id is null then
    select * into v_barrier from public.velmora_multiplayer_matchday_barriers
     where career_id = p_career_id and career_date = p_career_date;
    return jsonb_build_object('career_date', v_barrier.career_date, 'status', v_barrier.status,
                              'required', v_barrier.required, 'created', false);
  end if;

  perform public.velmora_mp_append_event(
    p_career_id, 'BARRIER_OPENED',
    jsonb_build_object('career_date', p_career_date, 'required', v_clean),
    'barrier-open:' || p_career_date::text, 'BARRIER:' || p_career_date::text, null, null, null);

  return jsonb_build_object('career_date', v_barrier.career_date, 'status', v_barrier.status,
                            'required', v_barrier.required, 'created', true);
end;
$$;

-- ---- readiness / line-up lock ---------------------------------------
create or replace function public.velmora_mp_submit_match_state(
  p_career_id uuid,
  p_fixture_id text,
  p_club_id text,
  p_state text,
  p_career_date date default null,
  p_lineup jsonb default '{}'::jsonb,
  p_tactics jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_state text := upper(coalesce(p_state,'PREPARING'));
  v_existing public.velmora_multiplayer_match_submissions;
  v_resolved boolean := false;
  v_opponent_committed boolean := false;
begin
  if not public.velmora_mp_is_active_member(p_career_id) then
    raise exception 'VELMORA_NOT_A_MEMBER' using errcode = '42501';
  end if;
  if not public.velmora_mp_owns_club(p_career_id, p_club_id) then
    raise exception 'VELMORA_NOT_YOUR_CLUB' using errcode = '42501';
  end if;
  if v_state not in ('PREPARING','READY','PLAYING','COMPLETED') then
    raise exception 'VELMORA_BAD_STATE' using errcode = '22023';
  end if;

  select * into v_existing from public.velmora_multiplayer_match_submissions
   where career_id = p_career_id and fixture_id = p_fixture_id and user_id = v_uid for update;

  -- A resolved fixture is frozen for good: a late tab can neither unlock a
  -- played match nor rewrite the line-up it was played on.
  select exists (select 1 from public.velmora_multiplayer_match_results
                  where career_id = p_career_id and fixture_id = p_fixture_id)
    into v_resolved;

  -- In a human-versus-human tie, the moment the other manager has also
  -- confirmed, both line-ups are locked. Neither side can then change a
  -- selection the other has already committed against.
  select exists (select 1 from public.velmora_multiplayer_match_submissions
                  where career_id = p_career_id and fixture_id = p_fixture_id
                    and user_id <> v_uid and state in ('READY','PLAYING','COMPLETED'))
    into v_opponent_committed;

  if found and v_existing.state = 'COMPLETED' then
    return jsonb_build_object('fixture_id', p_fixture_id, 'state', 'COMPLETED', 'frozen', true);
  end if;

  if v_resolved or (v_opponent_committed and found
                    and v_existing.state in ('READY','PLAYING','COMPLETED')) then
    return jsonb_build_object('fixture_id', p_fixture_id,
                              'state', coalesce(v_existing.state, v_state), 'frozen', true);
  end if;

  insert into public.velmora_multiplayer_match_submissions
    (career_id, fixture_id, user_id, club_id, career_date, state, lineup, tactics, locked_at, updated_at)
  values (p_career_id, p_fixture_id, v_uid, p_club_id, p_career_date, v_state,
          coalesce(p_lineup,'{}'::jsonb), coalesce(p_tactics,'{}'::jsonb),
          case when v_state in ('READY','PLAYING','COMPLETED') then now() else null end, now())
  on conflict (career_id, fixture_id, user_id) do update
    set state = excluded.state,
        career_date = coalesce(excluded.career_date, public.velmora_multiplayer_match_submissions.career_date),
        lineup = excluded.lineup,
        tactics = excluded.tactics,
        locked_at = case when excluded.state in ('READY','PLAYING','COMPLETED') then now() else null end,
        updated_at = now();

  update public.velmora_multiplayer_members set last_seen_at = now()
   where career_id = p_career_id and user_id = v_uid;

  return jsonb_build_object('fixture_id', p_fixture_id, 'state', v_state, 'frozen', false);
end;
$$;

-- ---- record a result, exactly once, forever -------------------------
-- Whoever gets there first writes it. Everyone else -- including the same
-- client after a refresh, a reconnect, or a second tab -- receives the
-- stored result instead of simulating a second time.
create or replace function public.velmora_mp_record_match_result(
  p_career_id uuid,
  p_fixture_id text,
  p_result jsonb,
  p_career_date date default null,
  p_home_club_id text default null,
  p_away_club_id text default null,
  p_home_score integer default 0,
  p_away_score integer default 0,
  p_resolution_mode text default 'QUICK_SIM'
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_row public.velmora_multiplayer_match_results;
  v_event jsonb;
begin
  if not public.velmora_mp_is_active_member(p_career_id) then
    raise exception 'VELMORA_NOT_A_MEMBER' using errcode = '42501';
  end if;

  select * into v_row from public.velmora_multiplayer_match_results
   where career_id = p_career_id and fixture_id = p_fixture_id;
  if found then
    return jsonb_build_object('fixture_id', v_row.fixture_id, 'authoritative', v_row.result,
                              'home_score', v_row.home_score, 'away_score', v_row.away_score,
                              'event_seq', v_row.event_seq, 'first_write', false,
                              'resolved_by', v_row.resolved_by);
  end if;

  perform 1 from public.velmora_multiplayer_careers where id = p_career_id for update;

  -- Re-check under the lock: a concurrent caller may have just won.
  select * into v_row from public.velmora_multiplayer_match_results
   where career_id = p_career_id and fixture_id = p_fixture_id;
  if found then
    return jsonb_build_object('fixture_id', v_row.fixture_id, 'authoritative', v_row.result,
                              'home_score', v_row.home_score, 'away_score', v_row.away_score,
                              'event_seq', v_row.event_seq, 'first_write', false,
                              'resolved_by', v_row.resolved_by);
  end if;

  v_event := public.velmora_mp_append_event(
    p_career_id, 'MATCH_RESULT',
    jsonb_build_object('fixture_id', p_fixture_id, 'home_score', p_home_score,
                       'away_score', p_away_score, 'result', p_result,
                       'resolution_mode', p_resolution_mode),
    'result:' || p_fixture_id, 'FIXTURE:' || p_fixture_id, null, p_fixture_id, null);

  insert into public.velmora_multiplayer_match_results
    (career_id, fixture_id, career_date, home_club_id, away_club_id,
     home_score, away_score, result, resolved_by, resolution_mode, event_seq)
  values (p_career_id, p_fixture_id, p_career_date, p_home_club_id, p_away_club_id,
          greatest(coalesce(p_home_score,0),0), greatest(coalesce(p_away_score,0),0),
          coalesce(p_result,'{}'::jsonb), v_uid, coalesce(p_resolution_mode,'QUICK_SIM'),
          (v_event->>'seq')::bigint)
  returning * into v_row;

  update public.velmora_multiplayer_match_submissions
     set state = 'COMPLETED', updated_at = now()
   where career_id = p_career_id and fixture_id = p_fixture_id;

  return jsonb_build_object('fixture_id', v_row.fixture_id, 'authoritative', v_row.result,
                            'home_score', v_row.home_score, 'away_score', v_row.away_score,
                            'event_seq', v_row.event_seq, 'first_write', true,
                            'resolved_by', v_row.resolved_by);
end;
$$;

-- ---- resolve the barrier, exactly once ------------------------------
-- Either eligible member may call this; the host does not have to be
-- online. Only one call can ever succeed for a given date.
create or replace function public.velmora_mp_resolve_barrier(
  p_career_id uuid,
  p_career_date date,
  p_next_date date
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_barrier public.velmora_multiplayer_matchday_barriers;
  v_row jsonb;
  v_outstanding jsonb := '[]'::jsonb;
  v_event jsonb;
begin
  if not public.velmora_mp_is_active_member(p_career_id) then
    raise exception 'VELMORA_NOT_A_MEMBER' using errcode = '42501';
  end if;

  perform 1 from public.velmora_multiplayer_careers where id = p_career_id for update;

  select * into v_barrier from public.velmora_multiplayer_matchday_barriers
   where career_id = p_career_id and career_date = p_career_date for update;
  if not found then raise exception 'VELMORA_NO_BARRIER' using errcode = 'P0002'; end if;

  if v_barrier.status = 'RESOLVED' then
    return jsonb_build_object('career_date', p_career_date, 'status', 'RESOLVED',
                              'resolved_by', v_barrier.resolved_by, 'next_date', v_barrier.next_date,
                              'resolution_seq', v_barrier.resolution_seq, 'first_resolver', false);
  end if;

  -- Every required human fixture or shared Advance gate must carry its one
  -- authoritative result. A manager converted to AI no longer counts.
  for v_row in select * from jsonb_array_elements(v_barrier.required) loop
    if exists (select 1 from public.velmora_multiplayer_members m
                where m.career_id = p_career_id
                  and m.user_id = (v_row->>'user_id')::uuid
                  and m.status = 'ACTIVE')
       and not exists (select 1 from public.velmora_multiplayer_match_results r
                        where r.career_id = p_career_id and r.fixture_id = (v_row->>'fixture_id')) then
      v_outstanding := v_outstanding || jsonb_build_array(v_row);
    end if;
  end loop;

  if jsonb_array_length(v_outstanding) > 0 then
    return jsonb_build_object('career_date', p_career_date, 'status', 'OPEN',
                              'outstanding', v_outstanding, 'first_resolver', false);
  end if;

  v_event := public.velmora_mp_append_event(
    p_career_id, 'DAY_ADVANCE',
    jsonb_build_object('from_date', p_career_date, 'to_date', p_next_date),
    'advance:' || p_career_date::text, 'DAY:' || p_career_date::text, null, null, null);

  update public.velmora_multiplayer_matchday_barriers
     set status = 'RESOLVED', resolved_by = v_uid, resolved_at = now(),
         resolution_seq = (v_event->>'seq')::bigint, next_date = p_next_date
   where career_id = p_career_id and career_date = p_career_date and status = 'OPEN'
   returning * into v_barrier;

  if v_barrier.career_id is null then
    select * into v_barrier from public.velmora_multiplayer_matchday_barriers
     where career_id = p_career_id and career_date = p_career_date;
    return jsonb_build_object('career_date', p_career_date, 'status', v_barrier.status,
                              'resolved_by', v_barrier.resolved_by, 'next_date', v_barrier.next_date,
                              'resolution_seq', v_barrier.resolution_seq, 'first_resolver', false);
  end if;

  update public.velmora_multiplayer_careers
     set career_date = p_next_date, updated_at = now() where id = p_career_id;

  return jsonb_build_object('career_date', p_career_date, 'status', 'RESOLVED',
                            'resolved_by', v_uid, 'next_date', p_next_date,
                            'resolution_seq', v_barrier.resolution_seq, 'first_resolver', true);
end;
$$;

-- ---- contested world mutation (transfers, prize money, world events) --
-- One winner per subject. The loser is told plainly, not silently merged.
create or replace function public.velmora_mp_claim_world_action(
  p_career_id uuid,
  p_kind text,
  p_subject_key text,
  p_payload jsonb default '{}'::jsonb,
  p_idempotency_key text default null,
  p_club_id text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_event jsonb;
begin
  if p_subject_key is null or length(btrim(p_subject_key)) = 0 then
    raise exception 'VELMORA_SUBJECT_REQUIRED' using errcode = '22023';
  end if;
  v_event := public.velmora_mp_append_event(
    p_career_id, coalesce(p_kind,'WORLD_ACTION'), coalesce(p_payload,'{}'::jsonb),
    coalesce(p_idempotency_key, p_subject_key), p_subject_key, p_club_id, null, null);
  return v_event;
end;
$$;

-- =====================================================================
-- 18. Presence, recovery and lifecycle
--     Presence is informative. Nothing here treats it as authority for
--     saved progress: a disconnect changes what the panel says, never
--     what the world contains.
-- =====================================================================
create or replace function public.velmora_mp_touch_presence(
  p_career_id uuid,
  p_status text default 'ONLINE',
  p_activity text default 'Menus',
  p_client_id text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if not public.velmora_mp_is_member(p_career_id) then
    raise exception 'VELMORA_NOT_A_MEMBER' using errcode = '42501';
  end if;
  insert into public.velmora_multiplayer_presence (career_id, user_id, status, activity, client_id, last_seen_at)
  values (p_career_id, v_uid,
          case when upper(coalesce(p_status,'ONLINE')) in ('ONLINE','AWAY','OFFLINE')
               then upper(p_status) else 'ONLINE' end,
          left(coalesce(nullif(btrim(p_activity),''),'Menus'), 40), p_client_id, now())
  on conflict (career_id, user_id) do update
    set status = excluded.status, activity = excluded.activity,
        client_id = excluded.client_id, last_seen_at = now();
  update public.velmora_multiplayer_members set last_seen_at = now()
   where career_id = p_career_id and user_id = v_uid;
  return jsonb_build_object('ok', true);
end;
$$;

-- Hand an absent manager's club to the AI so the career can continue.
-- The host may do this at any time; any member may do it once the other
-- manager has genuinely been gone for the grace period. Always audited.
create or replace function public.velmora_mp_convert_to_ai(
  p_career_id uuid,
  p_user_id uuid,
  p_reason text default 'ABSENT',
  p_grace_minutes integer default 15
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_member public.velmora_multiplayer_members;
  v_club text;
  v_last timestamptz;
begin
  if not public.velmora_mp_is_active_member(p_career_id) then
    raise exception 'VELMORA_NOT_A_MEMBER' using errcode = '42501';
  end if;

  perform 1 from public.velmora_multiplayer_careers where id = p_career_id for update;

  select * into v_member from public.velmora_multiplayer_members
   where career_id = p_career_id and user_id = p_user_id for update;
  if not found then raise exception 'VELMORA_NOT_A_MEMBER' using errcode = 'P0002'; end if;
  if v_member.status = 'AI_CONTROLLED' then
    return jsonb_build_object('user_id', p_user_id, 'status', 'AI_CONTROLLED', 'changed', false);
  end if;

  if not public.velmora_mp_is_host(p_career_id) then
    select greatest(m.last_seen_at, coalesce(pr.last_seen_at, m.last_seen_at)) into v_last
      from public.velmora_multiplayer_members m
      left join public.velmora_multiplayer_presence pr
        on pr.career_id = m.career_id and pr.user_id = m.user_id
     where m.career_id = p_career_id and m.user_id = p_user_id;
    if v_last > now() - make_interval(mins => greatest(coalesce(p_grace_minutes,15), 5)) then
      raise exception 'VELMORA_MANAGER_STILL_ACTIVE' using errcode = '42501';
    end if;
  end if;

  delete from public.velmora_multiplayer_club_claims
   where career_id = p_career_id and user_id = p_user_id returning club_id into v_club;

  update public.velmora_multiplayer_members
     set status = 'AI_CONTROLLED', ready = false, updated_at = now()
   where career_id = p_career_id and user_id = p_user_id;

  perform public.velmora_mp_append_event(
    p_career_id, 'MANAGER_CONVERTED_AI',
    jsonb_build_object('user_id', p_user_id, 'club_id', v_club, 'reason', coalesce(p_reason,'ABSENT')),
    'convert-ai:' || p_user_id::text || ':' || coalesce(v_club,'none'),
    'MANAGER_AI:' || p_user_id::text, v_club, null, null);

  insert into public.velmora_multiplayer_audit (career_id, action, actor_user_id, target_user_id, detail)
  values (p_career_id, 'MANAGER_CONVERTED_AI', v_uid, p_user_id,
          jsonb_build_object('club_id', v_club, 'reason', coalesce(p_reason,'ABSENT'),
                             'by_host', public.velmora_mp_is_host(p_career_id)));

  return jsonb_build_object('user_id', p_user_id, 'status', 'AI_CONTROLLED', 'club_id', v_club, 'changed', true);
end;
$$;

create or replace function public.velmora_mp_leave_career(p_career_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_club text; v_status text; v_role text;
begin
  if not public.velmora_mp_is_member(p_career_id) then
    raise exception 'VELMORA_NOT_A_MEMBER' using errcode = '42501';
  end if;
  perform 1 from public.velmora_multiplayer_careers where id = p_career_id for update;
  select status, role into v_status, v_role from public.velmora_multiplayer_members
   where career_id = p_career_id and user_id = v_uid;

  delete from public.velmora_multiplayer_club_claims
   where career_id = p_career_id and user_id = v_uid returning club_id into v_club;

  -- Leaving an in-progress career hands the club to the AI rather than
  -- deleting it, so the remaining manager keeps a coherent world.
  update public.velmora_multiplayer_members
     set status = case when (select status from public.velmora_multiplayer_careers where id = p_career_id) = 'ACTIVE'
                       then 'AI_CONTROLLED' else 'LEFT' end,
         ready = false, updated_at = now()
   where career_id = p_career_id and user_id = v_uid;

  insert into public.velmora_multiplayer_audit (career_id, action, actor_user_id, detail)
  values (p_career_id, 'MEMBER_LEFT', v_uid, jsonb_build_object('club_id', v_club, 'was_role', v_role));

  return jsonb_build_object('left', true, 'released_club_id', v_club);
end;
$$;

-- A host who never comes back must not be able to strand the career.
create or replace function public.velmora_mp_claim_host(p_career_id uuid, p_grace_minutes integer default 60)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_host public.velmora_multiplayer_members; v_last timestamptz;
begin
  if not public.velmora_mp_is_active_member(p_career_id) then
    raise exception 'VELMORA_NOT_A_MEMBER' using errcode = '42501';
  end if;
  perform 1 from public.velmora_multiplayer_careers where id = p_career_id for update;
  select * into v_host from public.velmora_multiplayer_members
   where career_id = p_career_id and role = 'HOST';
  if found and v_host.user_id = v_uid then
    return jsonb_build_object('host_user_id', v_uid, 'changed', false);
  end if;
  if found and v_host.status = 'ACTIVE' then
    select greatest(m.last_seen_at, coalesce(pr.last_seen_at, m.last_seen_at)) into v_last
      from public.velmora_multiplayer_members m
      left join public.velmora_multiplayer_presence pr
        on pr.career_id = m.career_id and pr.user_id = m.user_id
     where m.career_id = p_career_id and m.user_id = v_host.user_id;
    if v_last > now() - make_interval(mins => greatest(coalesce(p_grace_minutes,60), 15)) then
      raise exception 'VELMORA_HOST_STILL_ACTIVE' using errcode = '42501';
    end if;
  end if;

  update public.velmora_multiplayer_members set role = 'MANAGER', updated_at = now()
   where career_id = p_career_id and role = 'HOST';
  update public.velmora_multiplayer_members set role = 'HOST', updated_at = now()
   where career_id = p_career_id and user_id = v_uid;
  update public.velmora_multiplayer_careers set host_user_id = v_uid, updated_at = now()
   where id = p_career_id;

  insert into public.velmora_multiplayer_audit (career_id, action, actor_user_id, target_user_id, detail)
  values (p_career_id, 'HOST_TRANSFERRED', v_uid, v_host.user_id, jsonb_build_object('reason','HOST_ABSENT'));

  return jsonb_build_object('host_user_id', v_uid, 'changed', true);
end;
$$;

create or replace function public.velmora_mp_archive_career(p_career_id uuid, p_delete boolean default false)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if not public.velmora_mp_is_host(p_career_id) then
    raise exception 'VELMORA_HOST_ONLY' using errcode = '42501';
  end if;
  insert into public.velmora_multiplayer_audit (career_id, action, actor_user_id, detail)
  values (p_career_id, case when p_delete then 'CAREER_DELETED' else 'CAREER_ARCHIVED' end, v_uid, '{}'::jsonb);
  if coalesce(p_delete,false) then
    delete from public.velmora_multiplayer_careers where id = p_career_id;
    return jsonb_build_object('deleted', true);
  end if;
  update public.velmora_multiplayer_careers
     set status = 'ARCHIVED', archived_at = now(), updated_at = now() where id = p_career_id;
  return jsonb_build_object('archived', true);
end;
$$;

-- ---- manager-private drawer -----------------------------------------
create or replace function public.velmora_mp_save_private(
  p_career_id uuid, p_payload text, p_save_schema integer default 0
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if not public.velmora_mp_is_member(p_career_id) then
    raise exception 'VELMORA_NOT_A_MEMBER' using errcode = '42501';
  end if;
  insert into public.velmora_multiplayer_manager_private
    (career_id, user_id, payload, bytes, save_schema, updated_at)
  values (p_career_id, v_uid, coalesce(p_payload,''), length(coalesce(p_payload,'')),
          coalesce(p_save_schema,0), now())
  on conflict (career_id, user_id) do update
    set payload = excluded.payload, bytes = excluded.bytes,
        save_schema = excluded.save_schema, updated_at = now();
  return jsonb_build_object('saved', true, 'bytes', length(coalesce(p_payload,'')));
end;
$$;

create or replace function public.velmora_mp_load_private(p_career_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_row public.velmora_multiplayer_manager_private;
begin
  if not public.velmora_mp_is_member(p_career_id) then
    raise exception 'VELMORA_NOT_A_MEMBER' using errcode = '42501';
  end if;
  -- Scoped to the caller: this function can never read another manager.
  select * into v_row from public.velmora_multiplayer_manager_private
   where career_id = p_career_id and user_id = v_uid;
  if not found then return jsonb_build_object('found', false); end if;
  return jsonb_build_object('found', true, 'payload', v_row.payload,
                            'save_schema', v_row.save_schema, 'updated_at', v_row.updated_at);
end;
$$;

-- =====================================================================
-- 19. Reads
-- =====================================================================
create or replace function public.velmora_mp_my_careers()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(row order by (row->>'updated_at') desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'career_id', c.id, 'name', c.name, 'status', c.status, 'privacy', c.privacy,
      'join_code', case when m.role = 'HOST' then c.join_code else null end,
      'is_host', m.role = 'HOST', 'member_status', m.status,
      'game_version', c.game_version, 'save_schema', c.save_schema,
      'career_date', c.career_date, 'season_id', c.season_id,
      'revision', c.revision, 'snapshot_revision', c.snapshot_revision,
      'club_id', cl.club_id, 'club_name', cl.club_name,
      'manager_name', mp.manager_name,
      'members', (select count(*) from public.velmora_multiplayer_members x
                   where x.career_id = c.id and x.status = 'ACTIVE'),
      'max_members', c.max_members,
      'last_played_at', m.last_seen_at,
      'updated_at', c.updated_at
    ) as row
    from public.velmora_multiplayer_members m
    join public.velmora_multiplayer_careers c on c.id = m.career_id
    left join public.velmora_multiplayer_club_claims cl on cl.career_id = c.id and cl.user_id = m.user_id
    left join public.velmora_multiplayer_manager_profiles mp on mp.career_id = c.id and mp.user_id = m.user_id
    where m.user_id = auth.uid() and m.status in ('ACTIVE','AI_CONTROLLED')
  ) s;
$$;

-- One round trip for everything a client needs to render and reconcile.
-- Deliberately excludes snapshot payloads and club payloads: those are
-- pulled on demand so routine polling stays small.
create or replace function public.velmora_mp_sync(p_career_id uuid, p_since_seq bigint default 0)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_career public.velmora_multiplayer_careers; v_result jsonb;
begin
  if not public.velmora_mp_is_member(p_career_id) then
    raise exception 'VELMORA_NOT_A_MEMBER' using errcode = '42501';
  end if;
  select * into v_career from public.velmora_multiplayer_careers where id = p_career_id;

  select jsonb_build_object(
    'career', jsonb_build_object(
      'career_id', v_career.id, 'name', v_career.name, 'status', v_career.status,
      'privacy', v_career.privacy, 'host_user_id', v_career.host_user_id,
      'join_code', case when public.velmora_mp_is_host(p_career_id) then v_career.join_code else null end,
      'game_version', v_career.game_version, 'save_schema', v_career.save_schema,
      'world_seed', v_career.world_seed, 'career_date', v_career.career_date,
      'season_id', v_career.season_id, 'revision', v_career.revision,
      'snapshot_revision', v_career.snapshot_revision, 'max_members', v_career.max_members,
      'server_time', now()),
    'members', coalesce((select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'role', m.role, 'status', m.status,
        'display_name', m.display_name, 'ready', m.ready,
        'client_version', m.client_version, 'last_seen_at', m.last_seen_at,
        'manager_name', mp.manager_name, 'club_id', cl.club_id, 'club_name', cl.club_name,
        'presence_status', pr.status, 'activity', pr.activity, 'presence_at', pr.last_seen_at))
      from public.velmora_multiplayer_members m
      left join public.velmora_multiplayer_manager_profiles mp on mp.career_id = m.career_id and mp.user_id = m.user_id
      left join public.velmora_multiplayer_club_claims cl on cl.career_id = m.career_id and cl.user_id = m.user_id
      left join public.velmora_multiplayer_presence pr on pr.career_id = m.career_id and pr.user_id = m.user_id
      where m.career_id = p_career_id), '[]'::jsonb),
    'club_state', coalesce((select jsonb_agg(jsonb_build_object(
        'club_id', s.club_id, 'revision', s.revision, 'updated_by', s.updated_by, 'updated_at', s.updated_at))
      from public.velmora_multiplayer_club_state s where s.career_id = p_career_id), '[]'::jsonb),
    'barrier', (select to_jsonb(b) from public.velmora_multiplayer_matchday_barriers b
                 where b.career_id = p_career_id and b.status = 'OPEN'
                 order by b.career_date limit 1),
    'submissions', coalesce((select jsonb_agg(jsonb_build_object(
        'fixture_id', sub.fixture_id, 'user_id', sub.user_id, 'club_id', sub.club_id,
        'state', sub.state, 'career_date', sub.career_date, 'updated_at', sub.updated_at))
      from public.velmora_multiplayer_match_submissions sub
      where sub.career_id = p_career_id
        and (sub.career_date is null or sub.career_date >= coalesce(v_career.career_date, sub.career_date))), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object(
        'seq', e.seq, 'kind', e.kind, 'club_id', e.club_id, 'fixture_id', e.fixture_id,
        'subject_key', e.subject_key, 'actor_user_id', e.actor_user_id,
        'payload', e.payload, 'created_at', e.created_at) order by e.seq)
      from (select * from public.velmora_multiplayer_events
             where career_id = p_career_id and seq > coalesce(p_since_seq,0)
             order by seq limit 500) e), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.velmora_mp_fetch_snapshot(p_career_id uuid, p_revision bigint default null)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_snap public.velmora_multiplayer_world_snapshots;
begin
  if not public.velmora_mp_is_member(p_career_id) then
    raise exception 'VELMORA_NOT_A_MEMBER' using errcode = '42501';
  end if;
  if p_revision is null then
    select * into v_snap from public.velmora_multiplayer_world_snapshots
     where career_id = p_career_id order by revision desc limit 1;
  else
    select * into v_snap from public.velmora_multiplayer_world_snapshots
     where career_id = p_career_id and revision = p_revision;
  end if;
  if not found then return jsonb_build_object('found', false); end if;
  return jsonb_build_object('found', true, 'revision', v_snap.revision, 'payload', v_snap.payload,
                            'checksum', v_snap.checksum, 'save_schema', v_snap.save_schema,
                            'career_date', v_snap.career_date, 'bytes', v_snap.bytes);
end;
$$;

-- =====================================================================
-- 20. Grants and realtime
-- =====================================================================
do $$
declare fn text;
begin
  foreach fn in array array[
    'velmora_mp_is_member(uuid)','velmora_mp_is_active_member(uuid)','velmora_mp_is_host(uuid)',
    'velmora_mp_owns_club(uuid,text)',
    'velmora_mp_create_career(text,text,text,text,integer,text)',
    'velmora_mp_preview_career(text)',
    'velmora_mp_join_career(text,text,text,text)',
    'velmora_mp_claim_club(uuid,text,text,jsonb,text,jsonb)',
    'velmora_mp_release_club(uuid)','velmora_mp_set_ready(uuid,boolean)',
    'velmora_mp_append_event(uuid,text,jsonb,text,text,text,text,bigint)',
    'velmora_mp_publish_club_state(uuid,text,jsonb,bigint)',
    'velmora_mp_start_career(uuid,text,date,text,text,text,integer)',
    'velmora_mp_write_snapshot(uuid,bigint,text,text,integer,date)',
    'velmora_mp_open_barrier(uuid,date,jsonb)',
    'velmora_mp_submit_match_state(uuid,text,text,text,date,jsonb,jsonb)',
    'velmora_mp_record_match_result(uuid,text,jsonb,date,text,text,integer,integer,text)',
    'velmora_mp_resolve_barrier(uuid,date,date)',
    'velmora_mp_claim_world_action(uuid,text,text,jsonb,text,text)',
    'velmora_mp_touch_presence(uuid,text,text,text)',
    'velmora_mp_convert_to_ai(uuid,uuid,text,integer)',
    'velmora_mp_leave_career(uuid)','velmora_mp_claim_host(uuid,integer)',
    'velmora_mp_archive_career(uuid,boolean)',
    'velmora_mp_save_private(uuid,text,integer)','velmora_mp_load_private(uuid)',
    'velmora_mp_my_careers()','velmora_mp_sync(uuid,bigint)','velmora_mp_fetch_snapshot(uuid,bigint)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;

-- Realtime notifies clients of relevant changes. Both clients receive the
-- unlocked state without anyone pressing refresh.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables
                    where pubname='supabase_realtime' and schemaname='public'
                      and tablename='velmora_multiplayer_events') then
      alter publication supabase_realtime add table public.velmora_multiplayer_events;
    end if;
    if not exists (select 1 from pg_publication_tables
                    where pubname='supabase_realtime' and schemaname='public'
                      and tablename='velmora_multiplayer_matchday_barriers') then
      alter publication supabase_realtime add table public.velmora_multiplayer_matchday_barriers;
    end if;
    if not exists (select 1 from pg_publication_tables
                    where pubname='supabase_realtime' and schemaname='public'
                      and tablename='velmora_multiplayer_match_submissions') then
      alter publication supabase_realtime add table public.velmora_multiplayer_match_submissions;
    end if;
    if not exists (select 1 from pg_publication_tables
                    where pubname='supabase_realtime' and schemaname='public'
                      and tablename='velmora_multiplayer_members') then
      alter publication supabase_realtime add table public.velmora_multiplayer_members;
    end if;
    if not exists (select 1 from pg_publication_tables
                    where pubname='supabase_realtime' and schemaname='public'
                      and tablename='velmora_multiplayer_presence') then
      alter publication supabase_realtime add table public.velmora_multiplayer_presence;
    end if;
  end if;
end $$;
