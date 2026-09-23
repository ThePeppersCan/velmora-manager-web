# VELMORA MANAGER — PLAYER CAREER
## Advanced AAA Production Master Prompt
### V106 · Target channel: `PLAYER CAREER` · Save schema 86 → 87

---

### Mission

Add a second way to live inside the existing 288-club world: as one player, from a teenager nobody has heard of to a career worth remembering.

Do **not** build a parallel game. The world simulation, calendar, fixtures, transfer market, match engine, discipline, statistics, awards, news and career memory already exist and are authoritative. Player Career changes **who you are inside that world** and **which levers you hold** — nothing else.

The mode must answer five questions at any moment:

1. Who am I, and where does this club currently rank me?
2. Why am I — or why am I not — in the team this week?
3. What can I do *today* to change that?
4. Is my career trending up, flat, or drifting?
5. What will this career be remembered for?

---

## Part 1 — Architecture

### 1.1 The single most important decision

**The user's character is a real player record in the world.** They are created, given an id, and inserted into `squadCache` for their club (or `freeAgentCache` when unsigned), flagged:

```js
isUserPlayer: true,
userCharacter: { /* appearance layer IDs, pronouns, origin */ }
```

They are *not* a special-cased shadow object. The moment they live in the normal player pool, every established system works on them for free:

| Existing system | What it gives the player career at zero cost |
|---|---|
| V43 Living Statistics | Career apps, goals, assists, ratings, xG, per-season history |
| V105 Player Pathways | Honest OVR/potential growth, seasonal reset, decline after 30 |
| V44 Role Familiarity | Retraining into a second position over years |
| V49 Traits | Earned playing traits with real engine effects |
| V26 Discipline | Cards, suspensions, bans |
| V20.6.5 Negotiation | Contract talks, wage, clauses — now aimed at *you* |
| V96 World History | Records, honours, a permanent place in the record book |
| V42 Career Memory | The debut, the first goal, the relegation, the move |
| V21 Live Engine | Your character on the pitch with the same rig as everyone else |
| Press Conference Engine | Reframed as player media duties |

Anything built as a bespoke "player career stat" that duplicates one of these is a defect.

### 1.2 Mode flag

```js
careerMode: 'MANAGER' | 'PLAYER'   // added to buildCareerSaveData()
```

- `saveSchema` 86 → 87.
- Migration: a save with no `careerMode` is `'MANAGER'`. Existing careers must load byte-identically.
- `careerMode` is immutable for the life of a save, with one exception: the retirement bridge (§6.4).

### 1.3 Reuse, do not fork

- One world seed, one calendar, one `advanceCareerDay`, one fixture list, one `simulateUserFixture`.
- `currentClub` still means "the club this career is attached to" — you simply have no authority over it.
- Screens: keep `screenSeason`, `screenMatchday`, `screenResults`. Replace `screenCentral`, `screenSquad`, `screenTransfers`, `screenOffice` with player-mode equivalents (§3).
- `goCareerScreen(name)` gains a player branch, or a sibling `goPlayerScreen(name)`. Do not duplicate the screen registry.

### 1.4 Out of scope for V106.0

- **Online / V104 multiplayer.** Player Career is single-player. Gate the Online Career entry point when `careerMode==='PLAYER'` and state why.
- Managing and playing at once (player-manager). Note it as a V107 candidate; do not half-build it.

---

## Part 2 — The authority inversion

Manager Career hands you: selection, tactics, transfers, contracts for others, staff, facilities, budget, board objectives, press conferences. Player Career takes **all of it away**.

That is the design problem. Every player-career mode that has ever failed, failed for one reason: **dead weeks**. Removing seven levers without replacing them leaves the player pressing "advance day" into a void.

Each removed lever gets a replacement of equal decision weight:

| Removed | Replaced by |
|---|---|
| Team selection | **Earning** selection — trust, sharpness, form, training performance |
| Tactics | Your personal role, the manager's individual instruction, and whether you follow it |
| Transfers in | Approaches from clubs, your agent, transfer requests, loan requests |
| Contracts for others | **Your** contract: wage, length, clauses, squad-status promises |
| Staff & facilities | Personal coaching investment, a mentor, lifestyle balance, sponsors |
| Board objectives | The manager's personal targets for you + your own stated ambitions |
| Manager press conferences | Player media duties, teammate and manager comments |

**Hard rule, and it must be a test:** *no more than two consecutive advanced days may pass with zero player-facing decision.* Every day must offer at least one of — a training session with a choice, a teammate or manager interaction, a media request, an agent message, a life event, a scouting or international note, or a fixture.

---

## Part 3 — Screen architecture

### 3.1 PLAYER HUB — replaces Central

The daily home. Answers questions 1–3 above the fold.

- **Hero.** Full-body created character in club kit, squad number, name, age, position, club crest, division, contract horizon.
- **This week.** Next fixture, your **selection outlook with a stated reason**, this week's training focus, any pending decisions.
- **Manager trust meter** with the four live factors currently helping or hurting — never an unexplained number. Same discipline as the existing board-confidence panel.
- **Squad-role ladder.** Reserve → Rotation → Prospect → Important → Crucial (reuse `CAREER_SQUAD_ROLES`). Show where you are, what the next rung requires, and the distance to it.
- **Condition.** Form, sharpness, fitness, morale — the existing player fields, presented as *yours*.
- **Milestone tracker.** The next two milestones and how close they are.

### 3.2 MY GAME — replaces Squad

Development, and only development.

- Attributes on the V105 readable bar scale, with growth this season and last season's movement.
- **Potential is hidden.** Show a narrowing scout band ("has the look of a top-flight player"), never the number. It tightens as you accumulate minutes.
- Role familiarity (V44) — pick a secondary role and grind it over seasons.
- Traits (V49) — which you have, which are within reach, what earns them.
- **Weekly personal training focus** with real, explained, non-linear effects. Reuse `trainingRules` and `weeklyTrainingDevelopmentFactor`; the club's focus still applies, yours stacks on top.
- Coach feedback in plain language, driven by actual numbers.

### 3.3 DRESSING ROOM — new

People. This is where a season becomes a story.

- Teammates with a relationship state, a mentor and/or mentee, and a direct rival for your position.
- Manager relationship, separate from trust: trust is "will he pick me", relationship is "does he rate me as a person".
- Club standing and fan opinion — reuse V103 Club Pulse and V101 People & Power.
- Clubhouse moments — reuse V90 Clubhouse Stories, reframed from the player's eye level.

### 3.4 CAREER — replaces Transfers + Office

Your business.

- Contract: wage, length, clauses, squad-status promise, renewal talks with accept / negotiate / decline.
- Agent: approaches from other clubs, loan offers, your own transfer request, interest heat map.
- Sponsors and off-pitch income, earned by reputation.
- Season-by-season record: club, division, apps, starts, goals, assists, average rating, honours.
- International call-ups and caps (§6.3).
- Inbox — reuse the existing correspondence layer with a player-shaped sender list.

### 3.5 SEASON / MATCHDAY / RESULTS — reframed, not rebuilt

Same screens, same data, viewed from the pitch instead of the touchline.

---

## Part 4 — The two new engines

### 4.1 AI Team Selection *(the highest-risk item in the release)*

Today `repairMatchdayLineupForFixture` only *repairs* a lineup. Player Career needs a genuine, explainable selection for your club, every fixture.

```js
aiSelectMatchdayLineup(club, fixture) -> { lineup, decisions:[{playerId, verdict, reason}] }
```

Inputs, all of them already visible to the player somewhere in the UI:

- Current OVR and role fit for the fixture's tactical shape
- Sharpness, fitness, form, morale
- Squad role and the manager's trust in that player
- Recent match ratings and minutes (rotation pressure)
- Suspension and injury availability
- Opponent strength and competition importance (rotate for a cup, not for a derby)
- The AI manager's tactical identity (`aiManagerTacticalProfile`) and his own job security

Non-negotiables:

- **Deterministic**, seeded from `worldSeed` + fixtureId, so a reload never re-rolls your place in the team.
- **Every decision produces a human-readable reason.** "Rested — third match in eight days." "Dropped after 5.8 against Sablefen." "Kept your place: highest sharpness in the squad." An opaque selection model kills this mode outright.
- **Applies to your club only.** Other clubs keep the cheap repair path. 288 clubs must not get 288 selection models.
- The reason shown on the teamsheet must be derivable from numbers the player could already see on the hub. No hidden dice.

### 4.2 Manager Trust

A 0–100 value on `playerCareerState`, moving on:

| Signal | Direction |
|---|---|
| Match rating vs. expectation for your squad role | ± |
| Training application and chosen focus | + slow |
| Following or ignoring the individual match instruction | ± |
| Discipline — cards, suspensions | − |
| Media answers that back or undermine the manager or squad | ± |
| Transfer request, refused renewal | − sharp |
| Goals and assists in matches that mattered | + |
| A manager change | reset toward a new baseline with a fresh assessment period |

Trust drives selection weight, squad role movement, contract offers and the manager's public comments. It must be shown with its four active factors at all times, exactly as board confidence is in Manager Career.

**A new manager is a story beat, not an accident.** When your club sacks its manager, the incoming one re-rates you from scratch — that is one of the most memorable things that can happen in a player career, and the existing manager market already generates it for free.

---

## Part 5 — Matchday, the emotional core

Five staged beats. This sequence is the mode.

**1 · Two days out.** Training report. A manager hint that reads as observation, not a promise — "he watched you closely through the finishing drill."

**2 · The teamsheet.** A real scene — the dressing room, the pegs, the sheet on the wall. **STARTING / BENCH / NOT IN SQUAD**, with the honest reason from §4.1. This is the single most important new moment in the release. It must never feel arbitrary and it must never feel automatic.

**3 · Pre-match.** The manager's individual instruction to *you* ("get in behind — we're going direct"). A personal objective ("create two chances"). And your own choice: play the instruction, or play your own way. Following it is safer for trust; ignoring it and succeeding is worth more, and failing costs more.

**4 · The match.** Watch — with the camera biased toward your character and your player highlighted — or sim. On the bench, you watch with an option to skip forward to your introduction. **With three starters and five on the bench, coming on is common: a substitute appearance must be its own moment, not a footnote.**

**5 · Full time.** Your rating and your line — goals, assists, xG, chances created, interceptions, tackles, saves — all of which `simulateUserFixture` already computes. Then the manager's verdict, the media reaction, the trust movement, and the dressing-room response.

Implementation notes:

- No change needed to `simulateUserFixture`. Add a `playerCareerAfterFixture(fixture)` hook alongside `v104AfterUserFixture`.
- Pass `focusPlayerId` into `engine.open({...})` so the live engine can bias camera and highlight. If the engine cannot do this today, ship V106.0 with a highlight ring only and note camera bias as a follow-up — do not block the release on it.
- When you are not in the squad, the fixture still resolves through the normal path. You simply watch it happen to you.

---

## Part 6 — The career arc

### 6.1 Starting paths

Mirrors the manager's two paths, plus one.

**01 · SIGN FOR A CLUB.** Browse only clubs that would *actually* take a 16–18 year old at OVR 45–55 — League Two, League One outliers, academy sides. Each card states why that club is interested and what they offer: squad role, minutes expectation, wage, contract length. No reputation fiction.

**02 · START UNSIGNED.** The trial route. Advance days; the season moves without you; trial invitations arrive; you play a trial match and earn — or fail to earn — a contract. Higher risk, better story. Reuse the Job Centre structure wholesale.

**03 · ACADEMY INTAKE.** *(optional third path)* Start inside a club's academy and fight for senior promotion. Ties directly into V73 Academy Intake Day.

### 6.2 Honest progression

Use the V105 model exactly as it stands — `ovr`, `potential` (bounded ≤ 94), `basePotential`, `dynamicPotentialDelta`, `careerGrowthThisSeason`, seasonal reset, decline from ~30. **Your character is not exempt from any of it.**

Growth comes from minutes played, training focus, role fit, coaching quality, age curve and match ratings. No XP bar. No guaranteed arc. Most careers will not produce a superstar — that is the point, and it is what makes the ones that do land.

Offer a clearly-labelled "exceptional talent" toggle at creation for players who want the fantasy. Label it as an easier career; do not hide it in a difficulty menu.

### 6.3 International career

Sixteen nations already exist as `country` on every club and player. Add a light national-team layer: call-ups weighted by form, reputation and nation; friendlies and a continental tournament on a two-year cycle; caps and international goals recorded in World History. High immersion return for low cost, because the fixture and simulation machinery already exists.

### 6.4 Retirement and the bridge

- Decline from ~30. Retirement window 32–38, with a real choice: one more year, drop a division, or stop.
- A testimonial match.
- A legacy summary written from career memory — not a generated brag sheet, the actual record.
- **Then: "Begin a manager career with this character."** The appearance, name, nation and earned reputation carry into a Manager Career save. This closes the loop between the two modes and is the single most distinctive thing this release can ship.

---

## Part 7 — The life layer

Restrained and context-first, in the spirit of Unexpected Events 2.0. One panel, not a life sim.

- **Lifestyle balance** — rest / gym / social / family / study, chosen weekly, with small effects on fitness, sharpness, morale, relationships and long-term injury risk.
- **Sponsors** — unlocked by reputation, providing income and light obligations.
- **Finances** — wage, savings, a simple statement. Money should mean something without becoming a spreadsheet.
- **Relationships** — a mentor, a rival for your position, close friends in the squad. These generate the events; the events do not generate them.
- **Injuries and rehab** — reuse the existing injury model, add a rehab arc with return-to-fitness choices and a genuine risk of rushing back.

Never manufacture drama. Every life event must be traceable to a real career fact, the same rule the V44 continuity scenes already follow.

---

## Part 8 — Engineering plan

### 8.1 New files (matching existing conventions)

```
player-career.js                     state model, trust, selection, milestones
player-career.css
player-career-ui.js                  hub / my game / dressing room / career screens
player-creator.js                    character creation on the manager rig + kit layers
data/player-kit-manifest.json        kit layer catalogue
tools/test_v106_player_career.cjs    release-suite test
tests/v106-player-career.spec.cjs    playwright visual/reachability
V106_PLAYER_CAREER_ART_AND_SPRITE_REQUIREMENTS.md
```

### 8.2 New screens in `index.html`

`screenPlayerCreator` · `screenPlayerStart` · `screenTrial` · `screenPlayerHub` · `screenMyGame` · `screenDressingRoom` · `screenPlayerCareerBusiness`

### 8.3 Changes in `app.js`

- `careerMode` into `buildCareerSaveData()` and the migration path in the payload applier
- `goCareerScreen` player branch
- `aiSelectMatchdayLineup(club, fixture)` (§4.1) used for the player's club only
- Gate every manager-only action behind `careerMode==='MANAGER'` — selection, tactics, transfers, staff, facilities, budget, board, manager press conferences
- `advanceCareerDay` gains player-career blockers: teamsheet day, media day, trial day, rehab checkpoint
- `playerCareerAfterFixture(fixture)` hook
- `focusPlayerId` passed to the live engine

### 8.4 Build order

| Phase | Deliverable | Gate |
|---|---|---|
| 1 | `careerMode` flag, save/migration, mode routing, manager-surface gating | Existing saves load unchanged |
| 2 | Player creation + the three start paths, character inserted into the world | Your player appears in a real squad and in the world's statistics |
| 3 | **AI selection + manager trust** | Every teamsheet has an honest, reproducible reason |
| 4 | Matchday five-beat sequence | The teamsheet moment lands |
| 5 | Player Hub, My Game, personal training | No dead weeks — the two-day rule holds |
| 6 | Dressing Room, Career/agent/contract, media duties | Every removed lever has its replacement |
| 7 | Life layer, milestones, internationals | The season has texture between fixtures |
| 8 | Retirement, legacy, the manager bridge | A finished career reads as a story |

Phase 3 is the release. If it is not honest and explainable, nothing after it matters.

---

## Part 9 — Test plan

`tools/test_v106_player_career.cjs`, wired into `npm run test:player-career` and the release suite:

- A manager save from V105 loads with `careerMode==='MANAGER'` and is byte-identical in behaviour
- A created player exists in `squadCache`, appears in `getSquad`, and accumulates V43 statistics
- Selection is deterministic across two runs of the same seeded fixture
- Every selection decision returns a non-empty, human-readable reason
- Trust moves in the expected direction for each signal in §4.2, and is bounded 0–100
- **No more than two consecutive advanced days produce zero player-facing decisions** over a simulated season
- The player's OVR/potential obey the V105 bounds — no exemption from decline
- A full simulated career (16 → retirement) completes without error and produces a non-empty legacy record
- Manager-only actions are unreachable in player mode
- Save round-trip preserves `playerCareerState` and the character's layer IDs

---

## Part 10 — Risk register

| Risk | Mitigation |
|---|---|
| **Opaque AI selection** — the mode's death condition | Every decision carries a reason derived from numbers already on screen |
| **Dead weeks** | The two-day rule, enforced by a test, not by intent |
| **Save bloat** from a composited character image | Store layer IDs only; composite at runtime through the existing `avatarRenderCache` |
| **Performance** | Player-layer day checks run against your club only, O(1) against 288-club sim |
| **Duplicated stat models** | Anything that shadows V43/V105 is a defect, caught in review |
| **Scope creep into player-manager** | Explicitly out of scope; note as V107 |
| **Trademark** | `assets/manager/outfits/outfit_special_liverpool_third.png` names a real club and contradicts the pack README's team-neutral, trademark-safe promise. Remove or rename before any wider release. Unrelated to this feature, but it lives in the rig this mode will reuse. |

---

*Art and sprite requirements are specified separately in `V106_PLAYER_CAREER_ART_AND_SPRITE_REQUIREMENTS.md`.*
