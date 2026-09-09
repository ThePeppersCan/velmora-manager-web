# V73 — Academy Intake Day & Development Feedback Polish — AAA Master Prompt

> Suggested version tag: **V73** (follows V72, the cinematic transfer negotiation prompt filed this same review pass). Confirm against your actual next version before filing README/SHA files.

## Audit context — read this first
This prompt follows a full read of the live player-development and youth-academy code (`applyMonthlyDevelopment`, `developYouthPlayer`, `generateYouthProspect`, `promoteProspect`, the `V2075_*` development-pathway functions, and `career-expansion.js`'s academy-league module) plus an actual run of the project's own automated suite in a clean Node environment: `node --check app.js`, `test:training` (both files), `test_player_quality.cjs`, `test_v71_player_performance.cjs`, `test_v71_performance_career.cjs`, `test_career_integrity.cjs`, `test_v45_release_grade_career.cjs`, and `audit_v45_long_career.cjs --smoke`. **Everything passed with no failures.** The player-development and youth-academy systems are working as intended and are already exceptionally deep — in several respects deeper than EA FC Career Mode's own (partly hidden) growth model. This prompt does not rebuild or re-tune any of it. It closes exactly one clearly-missing presentation moment and offers two small, optional polish items. Treat the "what already exists" section as authoritative — do not re-implement anything listed there.

## What already exists — do not rebuild
- **Monthly senior development** (`applyMonthlyDevelopment`): every contracted player under 31 and below their `potential` accrues `developmentProgress` each month from an age curve (16–20 fastest, tapering to 27+), current morale, current form, this-season appearances (starts + substitute minutes/90, capped), an individual "focus player" bonus (max 3 focus players at a time, set from the First Week / squad screens), the club's `trainingFocus` setting, the player's own `developmentPlan` (Balanced/Attacking/Playmaking/Defensive/Physical — each biases which of the six attributes grow, via `applyLivingDevelopmentStatGrowth`), a manager-trust/happiness nudge, loan involvement, and a `careerExpansion.developmentFactor` multiplier driven by **academy/coaching staff quality and facility level**. Growth is capped at `potential`, guarded against double-application per month (verified by both `test_v71_performance_career.cjs` and `test_career_integrity.cjs`), and produces a monthly inbox report plus a news story for notable improvers.
- **Rare dynamic potential growth**: a small, capped monthly chance for a 23–28-year-old in good form to have their `potential` ceiling itself raised (a "late bloomer"), separate from ordinary progress.
- **Youth Academy prospects** (`generateYouthProspect`, `developYouthPlayer`) grow annually at season rollover while still uncontracted, scaled by the same academy staff/facility factor, and are shown to the player as **ranges, not exact numbers** (`prospectRange`) — fog-of-war applies even to your own prospects, exactly like real scouting uncertainty.
- **A real academy reserve league** (`career-expansion.js`: `youthCompetition`/`youthTable`/`setYouthTeam`/`playYouth`), run automatically every in-game day for every club, with real fixtures against same-world academy rivals, a default auto-selected best-3 lineup if the user never touches it, an optional BALANCED/DEVELOPMENT/COMPETE plan, and match-based `academyMatchProgress` that can independently push a prospect's OVR toward their potential — surfaced in its own "ACADEMY LEAGUE" tab inside the Youth Academy screen.
- **Role conversion** (`v2075RoleConversionOptions`/`v2075ProcessRoleConversionMonth`): slow, age-sensitive position retraining that does not hand out a free OVR point.
- **Pathway advice and status** (`v2075DevelopmentStatus`, `v2075PathwayAdvice`, `v2075AcademyPathwayState`, `v2075LoanDevelopmentGrade`): plain-language coaching-style guidance (RAPID GROWTH / NEEDS MINUTES / SLOWING / PLATEAU / loan grading) driven entirely by real underlying numbers, not decoration.
- **Cinematic moments already wired to `v44ShowManagerScene`**: a monthly "Training Observation" scene spotlighting a focus player; an "ACADEMY BREAKTHROUGH" scene when a graduate is promoted *and* the promotion is actually notable (deliberately not spammed on routine squad backfills); a distinct "ACADEMY BREAKTHROUGH" scene the moment an academy graduate scores their first competitive goal; an "ACADEMY_WELCOME" mentor pairing scene; and captaincy scenes that specifically call out an academy graduate taking the armband.
- **Long-term narrative memory**: `careerArchiveMemoryHTML` maintains a running "Club Memory" archive across the whole save with a dedicated "Academy Legacy" section, breakthrough-season detection (`archiveLivingSquadSeason`), and a full per-season OVR-growth ledger per player.

Given all of that, do not add: a second hidden growth mechanic, a new potential system, a new academy staff/facility lever, a new role-conversion system, or a new pathway-advice system. They exist, they are tested, and they are good.

## The one real gap — Academy Intake Day
The annual academy class (`v2080AcademyIntake`, `preSeasonExperience.academyPickId`) currently arrives as a single stat line in the New Season Briefing ("`X RETIRED · Y ACADEMY`") with no dedicated moment of its own — unlike almost every other meaningful academy beat in this game, which gets a proper `v44ShowManagerScene`. This is the one place where the presentation genuinely falls short of the game's own established bar, and it's exactly the kind of moment EA FC Career Mode front-loads (a new-intake reveal, best prospect highlighted).

### Required change: Academy Intake Day scene
Requirements:
- When the New Season Briefing opens (`openV2080NewSeasonExperience`) for a season whose `preSeasonExperience.intakeCount > 0`, fire one `v44ShowManagerScene` call before or as the first step of the briefing, keyed uniquely per club/season (e.g. `V73-ACADEMY-INTAKE-${club.id}-${careerTime.seasonId}`) so it relies on the engine's own built-in dedupe (the same mechanism `v46ObserveTrainingSession` already uses) rather than inventing a new "seen" flag.
- Use `environmentType:'academy'` so the scene automatically resolves the existing academy facility art tier via `v46FacilityArtProfile`, exactly as the existing first-goal "ACADEMY BREAKTHROUGH" scene already does. Do not add new art assets for this.
- Feature the intake's top prospect (`preSeasonExperience.academyPickId`, resolved through `v2080AcademyIntake(club)`) as the scene's `player`, with `playerLabel: 'NEW INTAKE'` or similar. Copy should reference the size of the class and, using the existing `prospectRange` fog-of-war text (not exact numbers — do not leak hidden potential), give one line on the standout name.
- When `intakeCount` is 0 for the season, do not fire any scene — a quiet season should stay quiet, consistent with how promotion scenes already only fire when `major` is true.
- Must not alter `v2080AcademyIntake`, `generateYouthProspect`, `developYouthPlayer`, or any intake-generation logic — this is a presentation call added at the briefing entry point only.

Acceptance criteria:
- Opening the New Season Briefing in a season with a non-empty academy intake shows the new scene exactly once for that club/season, before or as the briefing's first step, and never again on repeat visits to the briefing that season.
- A season with zero academy intake shows no new scene and the briefing behaves exactly as it does today.
- The scene never displays an exact hidden potential number for the featured prospect.
- No change to `intakeCount`, `academyPickId`, or any other `preSeasonExperience` field.

## Optional polish (lower priority, presentation-only)

### 1. Make a standout individual performance by a young player feel immediate
Today, a huge individual match performance by an academy graduate or U23 player only shows up in the *next monthly* development report — there's no in-the-moment acknowledgement tied to that specific match, even though form (which already factors into monthly growth) is influenced by exactly this kind of result.
Requirements:
- Presentation only: after a fixture, if a club-contracted player aged ≤23 recorded a genuinely standout match rating, surface one short, existing-style toast or inbox line noting it (e.g. "Big performance today — it won't go unnoticed"). This must not add a second, hidden growth bonus on top of the existing monthly `formFactor`/`playFactor` — it is making an outcome the model already rewards *visible* at the moment it happens, not creating a new reward.
- Reuse the existing toast/inbox mechanisms; do not create a new notification system.

### 2. Make the Development Plan choice legible
The five development plans (`V2075_DEVELOPMENT_PLANS`) currently differ in effect size only by a fraction of a percentage point of monthly progress, explained by one line of copy each.
Requirements:
- In the existing development panel (`v2075` player-development markup), show the already-computed `v2075DevelopmentEstimate` months-to-next-step figure for the player's *current* plan next to what that estimate would be under Balanced, so the trade-off (faster ceiling growth vs. even attribute spread) is visible before switching. Pure display — do not change `livingDevelopmentPlanFactor` or any growth math.

## Save / simulation integrity — do not touch
Preserve exactly as-is: every formula and threshold inside `applyMonthlyDevelopment`, `developYouthPlayer`, `generateYouthProspect`, `promoteProspect`, `v2075*` functions, `career-expansion.js`'s `developmentFactor`/`playYouth`/`youthCompetition`, and all existing save fields. This pass adds one new presentation call plus two optional cosmetic surfacing changes — nothing here should require a save-schema version bump; confirm and state so explicitly in the delivery README if true.

## QA requirements
1. `node --check app.js`.
2. Re-run and confirm continued PASS on: `test:training`, `test:player-performance` (all three files), `test_career_integrity.cjs`, `test_v45_release_grade_career.cjs`, `audit_v45_long_career.cjs --smoke`.
3. Manual/automated: open the New Season Briefing in a save with a non-zero academy intake and confirm the new scene fires once; reopen the briefing and confirm it does not fire again; confirm a zero-intake season shows nothing new.
4. Confirm no hidden potential number is ever rendered in the new scene's copy.
5. If polish item 1 is included, confirm it never mutates `developmentProgress`, `lastDevelopmentGain`, or any other field — verify by diffing player state before/after the toast fires.

## Delivery
Deliver a concise `README_V73_ACADEMY_INTAKE_DAY.md` describing the change and QA results, filed alongside this prompt, then archived to `_archive/dev-notes/` per this project's existing convention once complete. Do not claim functionality that was not actually implemented or tested.
