# Velmora Manager V106 — Player Career Focused Slice

## Production brief

Act as the principal gameplay designer, simulation engineer, UI director, narrative systems designer, QA lead, and Steam release owner for Velmora Manager. Build V106 Player Career as a premium, replayable vertical slice inside the existing living career world. This is not a menu mock-up or a disconnected mini-game. The controlled athlete must be one canonical player record used by squads, contracts, form, fitness, fixtures, statistics, transfers, injuries, discipline, match presentation, and save/load.

Preserve Manager Career and Online Career without changing their player agency or save behaviour. Player Career is single-player in V106. Existing saves without a career-mode field must migrate to Manager Career.

## Player promise

The player should feel the tension of earning a place rather than choosing one. Every matchday answers four questions clearly:

1. Am I starting, on the bench, or not selected?
2. Why did the manager make that decision?
3. What happened when my team played?
4. How did my performance change the manager's trust in me?

The slice is complete only when a user can create or select an athlete, begin attached to a club or unsigned, reach a deterministic teamsheet, play or simulate the fixture, see an athlete-specific review, save, leave, reload, and continue.

## Required flow

### 1. Career-mode gate

- A new offline save first offers Manager Career and Player Career.
- Manager Career continues through the existing manager creator unchanged.
- Player Career enters the athlete setup flow.
- Online Career remains a manager-only route.

### 2. Athlete setup

Offer two equally valid starts:

- Create Athlete: name, age, primary role, and a curated existing player portrait. Generate balanced attributes from the selected role and the destination club's level.
- Select Existing Athlete: browse real generated squad players with club, role, age, overall, and portrait. Selecting one marks that exact record as the controlled athlete; do not clone it.

### 3. Career start

Created athletes can:

- Join a club: show plausible clubs whose playing level matches the athlete. Insert the athlete into the real squad, assign a real contract, and retain the club's AI manager.
- Start unsigned: place the athlete in the existing free-agent pool and show deterministic contract opportunities. Accepting one moves the same player record into the destination squad.

### 4. Manager trust

- Use a 0–100 saved value on the player record.
- Show both a readable status and the exact value.
- Trust must materially affect selection but never override injury, suspension, fitness, ability, tactical fit, or role coverage without explanation.
- Post-match trust changes are deterministic and are driven by rating, goals, assists, discipline, minutes, result contribution, and whether a substitute was used.
- Always display the latest trust change and the reason.

### 5. Deterministic AI teamsheet

Build the teamsheet once per fixture and save it by fixture ID. The same inputs must always return the same selection; reopening or reloading may not reroll it.

Score eligible players from visible factors:

- ability and match importance;
- fitness, sharpness, form, and morale;
- tactical fit and role coverage;
- squad status and recent workload;
- manager trust for the controlled athlete.

Return one of STARTING, BENCH, or NOT_SELECTED for every player and a concise decision explanation for the controlled athlete. Preserve exactly three starters and five bench places. Unavailable players must never be selected.

### 6. Teamsheet moment

Before every controlled-club fixture, present a dedicated matchday reveal with:

- competition, opponent, venue, and date;
- the AI manager and their tactical identity;
- the controlled athlete's portrait and verdict;
- all starters and bench players;
- an explicit reason panel with the contributing factors;
- a clear continue action appropriate to STARTING, BENCH, or NOT_SELECTED.

The user cannot edit the lineup or tactics in Player Career.

### 7. Player-focused match loop

- Reuse the existing match simulation and live match engine.
- A starting athlete participates from kick-off.
- A benched athlete has a deterministic participation outcome; the match report must distinguish used and unused substitutes.
- A non-selected athlete can follow or simulate the team match without being added to the participant ledger.
- Pass the controlled player ID to the live engine as focus context while retaining the normal broadcast and score simulation.

### 8. Post-match loop

The full-time screen must foreground:

- selection status and minutes;
- match rating or “did not play”;
- goals, assists, cards, and result;
- trust change with reason;
- current trust and next-selection outlook.

Continue returns to the Player Hub. Do not show manager press conferences, board decisions, transfer controls, team selection controls, or manager-only navigation in Player Career.

## Player Hub

Build one dense, controller-friendly home screen containing:

- athlete identity, club/free-agent status, role, overall, form, fitness, and season line;
- manager trust meter and manager identity;
- next fixture with a teamsheet call to action when it becomes matchday;
- most recent selection/performance review;
- unsigned offers when relevant;
- advance one day and advance to next match controls;
- access to the existing competition view and main menu.

No dead-end screen is acceptable. Every state must provide a clear next action.

## Engineering and save contract

- Add `careerMode: "MANAGER" | "PLAYER"` to the save payload.
- Add one normalized, versioned `playerCareerState` containing the controlled player ID, origin, status, selection snapshots, acknowledged teamsheets, offers, and last review.
- Migrate missing careerMode to MANAGER.
- Bump V106 release metadata, package metadata, cache keys, and save schema together.
- Keep all randomness seeded by world seed plus stable entity/fixture IDs.
- Reuse existing clubs, managers, players, portraits, match engine, statistics, contracts, and world calendar.
- Add unit/integrity coverage for migration, deterministic selection, trust influence, selection validity, unsigned signing, save/load, and post-match review.
- Add browser coverage for mode choice, athlete setup, Player Hub, three teamsheet verdict presentations, and responsive visual integrity.

## Acceptance gates

- Existing Manager Career tests remain green.
- Existing Online Career tests remain green.
- A legacy V105.2 save loads as Manager Career.
- Player Career survives save/reload with the same athlete and teamsheet.
- Identical fixture state produces an identical selection and reason.
- Exactly three starters and five bench slots are populated when eight eligible players exist.
- Injury and suspension exclusions are respected.
- Player Career offers no way to edit team selection or tactics.
- Starting, bench, and not-selected states are all legible without relying on colour alone.
- At 1280×720 and 1920×1080, no primary action, explanation, player identity, or result metric is clipped.
- The complete build, functional suite, and visual suite pass before release.
