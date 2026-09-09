# Velmora Manager V104 · Online Career

Two authenticated managers, two different clubs, one canonical world.
Asynchronous shared management with synchronised progression.

---

## 1. The experience

From the main menu, **ONLINE CAREER** (option 03) opens the online hub.

**Create** — name the career, choose invite-only or password-protected, and you
are taken to a lobby with a six-character join code and a copyable invitation
link. **Join** — enter the code; the career name, host and current date are
shown before you commit to anything.

In the lobby each manager picks an unclaimed club (searchable, filterable by
division, with taken clubs disabled) and confirms their manager — reusing the
game's real manager creator, not a lesser copy of it. Both seats show identity,
club crest, host badge, connected state, ready state and build version. The
host starts the career once both managers are ready.

Inside the career, everything works as it always has: squad, transfers, staff,
inbox, training, tactics, competitions, finances. A small chip sits in the
corner showing the other manager's name, club, online state and broad activity
("Squad", "Transfers", "Playing match"). It expands into a panel with the shared
date, whether progression is locked, and one sentence saying what the game is
waiting for:

> Waiting for Alex at Aurelia to complete their fixture. You may continue
> managing your club.

There are no repeated modals and no browser alerts.

### The matchday barrier

When the shared calendar reaches a date on which a human-controlled club has an
unplayed fixture, a **barrier** opens naming every such club. Each manager
prepares and completes their own fixture whenever they like. Completing one
saves its result immediately and idempotently, and that manager returns to the
menus with everything still available to them — but nobody can move the shared
date until every required human fixture has a stored result. A club with a bye,
a postponement or no fixture is never listed, so it can never block anyone.

Once the last required fixture is in, either manager's client resolves the
barrier. Exactly one call wins; the remaining AI fixtures resolve exactly once,
and both clients receive the unlocked state without pressing refresh.

For a human-versus-human fixture, both managers confirm readiness, both
line-ups lock the moment the second confirmation lands, and the tie is resolved
once by the existing deterministic engine. One result is stored. Neither device
simulates a contradictory version.

---

## 2. Architecture decisions

**The world is a log, not a file.** The failure mode this feature has to avoid
is one client uploading a whole stale save over another's work. So a shared
career is a periodically compacted **snapshot** plus a gap-free, totally
ordered **event log**. Clients apply events in `seq` order and never below a
sequence they have already applied, which is what makes refresh, reconnect and
a duplicate realtime frame all harmless.

**Three partitions, decided by audit of the real save.** `saveCareerState()`
was read key by key and every key classified:

| Partition | Contents | Who may write |
|---|---|---|
| **Shared** | calendar, fixtures, competitions, clubs and divisions, players, transfers, contracts, finances, world events, AI actions, career seed, results | the log, via RPC |
| **Club** | `squads`, `lineups`, `clubBudgets`, `academies` for one club | only that club's claimant |
| **Private** | shortlist, scouting assignments and unrevealed reports, draft tactics, inbox and read state, confidential decisions, interface preferences | never leaves the owner |

An unrecognised key defaults to **shared**, because silently privatising world
state is exactly how two devices come to disagree.

**Per-club optimistic concurrency.** Each manager's club is one row with a
`revision`. Writes carry the revision the client last read; a mismatch is
rejected with `VELMORA_STALE_CLUB_STATE`. A stale tab therefore cannot
overwrite newer data, and it never uploads a whole world to do so — it pulls
the newer world and replays only its own club on top.

**Two different kinds of "only once".** `idempotency_key` is unique per career
and makes a retry return the original event. `subject_key` is *also* unique per
career and makes a contested action have exactly one winner forever. One
mechanism covers match results (`FIXTURE:…`), calendar advances (`DAY:…`),
transfers (`PLAYER:…:window`), prize money (`PRIZE:…`) and inbox events
(`INBOX:…`). A retry succeeds quietly; a contest returns a sentence the losing
manager can act on.

**Determinism was already there.** `simulateBackgroundFixture` seeds from
`mulberry32(hashString(worldSeed + '-WORLD-MATCH-' + fixtureId))`. That is why
both devices can resolve the same AI fixtures and agree. Nothing authoritative
reads the wall clock or an unseeded `Math.random()`, and
`assertDeterministicSeed()` rejects a seed containing a timestamp.

**Applied results are never re-rolled.** An authoritative result carries the
score plus the match report (scorers, assists, ratings, discipline, player of
the match). `applyMatchResult` writes those values through the existing effect
functions rather than re-simulating, so both devices record identical
statistics rather than merely identical scorelines.

**Nothing depends on the host being online.** The host owns invitations,
starting and archiving. Progression does not: any active member may resolve a
completed barrier, and an absent host can be replaced after a grace period.

**Presence is decoration.** It changes what the panel says and never what the
world contains. A disconnected manager still blocks their fixture; the escape
hatch is an explicit, confirmed, audited handover of their club to the AI.

**Multiplayer is additive.** The single-player save payload is byte-for-byte
unchanged — a save written by V103.3 loads in V104 and vice versa. The online
world lives in its own tables and never touches
`velmora_manager_career_slots`.

### Trade-offs worth knowing

- **Snapshots are stored in Postgres `text`, not Storage.** A snapshot is about
  1.4 MB (gzip + base64) and only the three newest per career are kept. Storage
  would be cheaper, but a row keeps the snapshot atomically consistent with the
  revision guard that protects it. Moving to Storage is a clean later change.
- **Two managers, deliberately.** `max_members` is constrained to 2. Widening it
  means revisiting seat accounting and the barrier's required list.
- **The live Quidditch broadcast is for fixtures against AI clubs.** A
  human-versus-human tie resolves through the deterministic engine so both
  devices agree by construction rather than by racing.

---

## 3. Files

### New

| File | Purpose |
|---|---|
| `supabase-velmora-manager-multiplayer.sql` | Schema, RLS, 26 RPCs. Idempotent. |
| `multiplayer-core.js` | Shared rules: partitioning, barrier logic, seeds, conflict plans, player-facing language. No DOM, no network. |
| `multiplayer-client.js` | Supabase transport: session, ordered event pull, realtime, retry queue, conflict recovery. |
| `multiplayer-ui.js` | Lobby, online-careers list, status chip and panel, recovery actions. |
| `multiplayer.css` | Styling in the existing menu language; responsive and reduced-motion aware. |
| `tools/test_v104_multiplayer_core.cjs` | Shared-rules tests. |
| `tools/test_v104_multiplayer_sync.cjs` | Full scenario suite, in-process. |
| `tools/test_v104_multiplayer_career.cjs` | Scenarios against the real career engine. |
| `tools/test_v104_multiplayer_database.cjs` | Same scenarios against real PostgreSQL + real RLS. |
| `tools/mp/mp_scenarios.cjs` | The scenario suite both backends are held to. |
| `tools/mp/mp_server_memory.cjs` | In-process implementation of the RPC contract. |
| `tools/mp/mp_pg.cjs` | Supabase-shaped client over `psql`. |
| `tools/mp/mp_fake_game.cjs` | Minimal world implementing the bridge contract. |
| `tools/mp/supabase_local_harness.sql` | Local-only `auth` schema + roles. Never run against Supabase. |
| `tests/online-career.spec.cjs` | Layout, keyboard and reduced-motion checks. |

### Changed

| File | Change |
|---|---|
| `app.js` | Split `buildCareerSaveData()` out of `saveCareerState()` and `applyCareerSaveData()` out of `loadCareerState()`; added the V104 bridge and session lifecycle; reserved human clubs from local AI simulation; gated `advanceCareerDay()` on the shared barrier; gated and reported `simulateUserFixture()`; **fixed** the main menu's Enter handler hijacking Enter from any focused control outside the menu. |
| `index.html` | ONLINE CAREER menu option (03), new stylesheet and scripts, cache key. |
| `cloud-saves.js` | Exposes `client()` and `user()` so an online career reuses the signed-in connection instead of asking for a second sign-in. |
| `career-bootstrap.js`, `release-meta.js`, `package.json` | V104 release metadata and cache key; two new test scripts. |
| `tools/release_manifest.cjs` | Ships the new runtime files. |
| `tools/career_test_runtime.cjs` | Loads `multiplayer-core.js`. |
| `tests/main-menu-tutorial.spec.cjs` | Updated for five menu options. |

---

## 4. Supabase configuration

Everything is one script. In the Supabase dashboard for the Repo Company
project, open **SQL Editor** and run the whole of
`supabase-velmora-manager-multiplayer.sql`. It is safe to re-run.

Then check:

1. **Realtime** — Database → Replication → `supabase_realtime`. The script adds
   `velmora_multiplayer_events`, `..._matchday_barriers`, `..._match_submissions`,
   `..._members` and `..._presence` if the publication exists. If your project
   has no `supabase_realtime` publication yet, create it and re-run the script.
   Without realtime the clients still work — they fall back to a six-second
   poll — but updates arrive less promptly.
2. **No new keys.** The browser continues to use only the existing publishable
   key already in `cloud-saves.js`. Do not put a service-role key anywhere near
   the client.
3. **Nothing to configure for auth.** Online careers use the session the game
   already receives from the Repo Company bridge.

Verify with:

```sql
select schema_version from public.velmora_multiplayer_schema;      -- 1
select count(*) from pg_policies where tablename like 'velmora_multiplayer%';
```

---

## 5. Deployment

```bash
cd "Velmora Manager"

npm run build          # syntax-checks every runtime file and writes dist/
npm test               # the release suite
npm run test:visual    # Playwright layout and keyboard checks

git add -A
git commit -m "V104: online career for two managers"
git push origin main
```

Cloudflare Pages serves `dist/`. The V104 cache key
(`v104-online-career-20260909`) is on every asset reference, so returning
players get the new build without a hard refresh.

Order matters in one place only: **run the SQL before the deploy reaches
players**, or the online menu will report that online careers are unavailable.
Single-player is unaffected either way.

---

## 6. Manual two-browser checklist

Two different accounts. One ordinary window, one private window (or two
machines). Both signed in at Repo Company.

1. **A**: Online Career → Create → name it → lobby appears with a six-character
   code. Copy the invitation.
2. **B**: Online Career → Join → paste the code → the career name and host are
   shown before joining → join.
3. **A** claims a club. **B** tries to claim the *same* club → refused in plain
   language. **B** claims a different one.
4. Both mark ready. **A** starts. Both land in a normal career screen with the
   status chip in the corner.
5. **A** opens Transfers. **B**'s panel shows "Transfers" — and no bid, target
   or shortlist detail.
6. Advance to a date where both clubs play. Both see progression locked and the
   same waiting sentence.
7. **A** plays their fixture. **A** can still use every menu; the shared date
   has not moved; **B** sees A as complete.
8. **A** refreshes mid-career. The match is still played once, the score is
   unchanged, and the date is still held.
9. **B** plays their fixture. Within a few seconds both clients unlock — with no
   manual refresh — and the shared date advances by one on both.
10. Check a league table on both. Identical, including AI results.
11. Close **B** entirely. **A** advances to B's next matchday: still blocked, and
    B is shown as disconnected. Use "hand their club to the AI", confirm, and the
    calendar frees up.
12. Open **B** again: it reports the club is now AI-run, and the career still
    loads.
13. Turn off networking on **A** mid-session: a read-only state appears, the date
    pauses, and it reconnects on its own when networking returns.
14. Main menu → Continue Career. Every single-player save is exactly where it
    was.

---

## 7. Known limitations of the first release

- **Two managers per career.** Enforced in the schema, not just the interface.
- **No live head-to-head match controls.** A human-versus-human tie resolves
  through the deterministic engine after both line-ups lock. The live broadcast
  remains available for fixtures against AI clubs.
- **One human manager per club, always.** The "two managers, one club" option is
  designed for but not implemented.
- **Snapshots live in a Postgres column.** Fine at this size; a Storage-backed
  snapshot would be cheaper for very long careers.
- **Sign-in is via the Repo Company bridge.** Launching the game standalone
  gives you single-player and cloud saves, but the online menu will ask you to
  sign in.
- **Realtime is a convenience, not a dependency.** If the websocket cannot
  connect, clients poll every six seconds. Correctness is unaffected;
  responsiveness is.
- **Transfers between the two human clubs** go through the same one-winner
  mechanism as any contested action, but there is no negotiation flow between
  two human managers yet — the AI valuation path is used.
- **Archived careers cannot be restored from inside the game.** The host can
  archive; un-archiving is a database action for now.
