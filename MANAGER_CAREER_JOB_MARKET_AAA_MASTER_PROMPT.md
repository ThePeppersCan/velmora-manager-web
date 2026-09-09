# VELMORA MANAGER — MANAGER CAREER & LIVE JOB MARKET
## Advanced AAA Production Master Prompt

### Mission

Transform Manager Career from a passive statistics page into a premium, living career command centre. It must make the player feel like a named manager whose reputation, security, relationships and opportunities evolve inside a 288-club world.

Do not build a disconnected mini-game or replace the established simulation. Surface and deepen the existing authoritative systems: AI managers, vacancies, caretakers, applications, interviews, job offers, contracts, board confidence, career spells, rivalries, reputation, press narratives and career memory.

The result must answer five questions instantly:

1. Who am I in this world?
2. Why is my reputation and job security at its current level?
3. What is happening in the wider managerial market?
4. What can I do today to change my trajectory?
5. What will this career remember years from now?

### Experience Pillars

#### 1. Manager identity has presence

- Use the player-created manager as the visual anchor, not a tiny thumbnail.
- Present current club, origin, reputation tier, job security and career record as a coherent identity.
- The manager and club crest must have intentional scale and hierarchy.
- A new career must still look authored and complete even when every career statistic is zero.

#### 2. Every rating explains itself

- Never show reputation, board confidence or security as unexplained numbers.
- Display the live factors currently helping, limiting or threatening the manager.
- Use actual form, league position versus expectation, board confidence, tenure, honours and career achievements.
- Separate current job security from long-term manager reputation.
- State what the next reputation tier unlocks and show progress toward it.

#### 3. The market is always alive

- Surface sackings, pressure stories, caretaker appointments, vacancies, shortlists, permanent appointments and club approaches.
- When no vacancies exist, replace empty space with market intelligence: market temperature, managers under observation, clubs closest to the player’s profile and the gap to realistic candidacy.
- Never manufacture fake vacancies for presentation.
- Clearly distinguish “profile fit”, “club monitoring”, “formal interview” and “job offer”.

#### 4. Career decisions are staged conversations

- Applications remain deliberate and persistent.
- Interviews use the club’s real expectation, tactical identity, world and squad context.
- Job offers take place in a boardroom-style scene with the created manager, club identity and clear terms.
- Allow one credible negotiation request per job offer: improved salary or protected recruitment resources.
- A refused request must not silently cancel the underlying offer unless the simulation explicitly decides that.
- Contract renewals become discussions with accept, negotiate and decline paths.
- All decisions must save durably and remain idempotent.

#### 5. The career becomes an archive

- Present every managerial spell as a readable chapter with dates, club, division, record and exit reason.
- Surface honours, promotions, major appointments, dismissals and rivalries without duplicating the career-memory ledger.
- Preserve the existing save schema and migration behaviour.

### Screen Architecture

#### Command Hero

- Full-width visual header.
- Large created-manager presentation.
- Current club crest and competition context.
- Reputation score and tier.
- Job-security state and score.
- Career record, clubs managed, honours, promotions and contract horizon.

#### Your Career

- “Current mandate” card showing the board expectation and immediate competitive context.
- “Why your position looks like this” panel with four live security/reputation signals.
- Reputation trajectory showing the next tier and the distance remaining.
- Live manager-network feed.
- Career targets showing clubs nearest to the manager’s current profile without falsely claiming interest.
- Full career-spell timeline and existing rivalry history.

#### Open Vacancies

- Real vacancies only.
- Club, division, table position, board target, budget, caretaker, market stage and player fit.
- Application, interview and watchlist states remain persistent.
- Zero-vacancy state becomes an intelligence briefing, not a blank panel.

#### Club Interest

- Clearly explain that monitoring is not an offer.
- Show the factors driving interest.
- If nobody is monitoring, show attainable future targets and the reputation/fit gap.

#### Contract

- Current term, salary, expiry, progress and board expectation.
- Active board review where applicable.
- Renewal discussion with accept, negotiate and decline choices.
- Resignation remains explicit and protected by the existing confirmation.

### Art Direction

- Premium sports-management broadcast language layered over Velmora’s established office presentation.
- Deep navy, club accent, restrained gold and teal signals.
- Strong typographic scale; avoid micro-text and decorative emptiness.
- Use existing manager layers, club crests and office/location art.
- No new sprites are required.
- Empty states must be informative compositions, not oversized blank rectangles.
- Responsive composition must remain inside the shared 16:9 game frame.

### Functional Rules

- Continue using `managerMarket` as the source of truth.
- Do not create a second job-market simulation.
- Additive optional fields on existing offer records are permitted.
- A negotiated recruitment-resource bonus applies only after the player accepts the job.
- One negotiation request per offer; repeat attempts must be rejected safely.
- Existing AI appointment, caretaker, application, interview, dismissal and contract-expiry flows must remain intact.
- Existing saves must load without requiring migration.
- All buttons must have visible terminal states and keyboard-accessible semantics.

### Required States

- Employed, secure.
- Employed, under concern.
- Formal performance review.
- Final warning.
- Unemployed.
- No live vacancies.
- Live vacancies with caretaker context.
- Application submitted.
- Interview ready and completed.
- Unsolicited approach.
- Formal job offer.
- Offer negotiation accepted and refused.
- Contract extension available.
- Contract negotiation accepted and refused.
- Multiple completed career spells.

### Acceptance Criteria

- Manager Career uses the full available content width with no unexplained empty half-screen.
- The created manager is a major visual element.
- At least four real factors explain current security/reputation.
- The next reputation milestone is visible and calculated from live state.
- The manager-network feed supports pressure, departures, vacancies, caretakers and appointments.
- A zero-vacancy career still provides useful, truthful market intelligence.
- Job offers support one persistent negotiation request.
- Contract extensions support an interactive discussion.
- Career spells remain readable at laptop and wide-short resolutions.
- Existing career saves, manager-market simulation and release tests continue to pass.
- Dedicated browser screenshots protect the Manager Career overview and market states.

### Non-Goals

- Do not add a new world, competition or standalone economy.
- Do not invent manager skill trees without simulation effects.
- Do not add cosmetic currencies or arbitrary XP.
- Do not generate new sprites merely to fill space.
- Do not hide weak information architecture behind another modal-only interface.
