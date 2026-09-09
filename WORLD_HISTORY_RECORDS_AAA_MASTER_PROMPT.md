# VELMORA MANAGER — WORLD HISTORY, RECORDS & TACTICAL IDENTITY

## Advanced production master prompt

Create a premium, release-quality career-mode expansion for Velmora Manager that makes its four worlds feel older than the player, aware of the present season, and permanently shaped by every result. The work must feel comparable in depth, clarity and theatre to a major paid sports-management game on Steam. It must not feel like a collection of static cards, placeholder text or disconnected menus.

### Product mission

Turn Season → Records into a living World History centre. A brand-new career must immediately show believable established champions and holders. A long-running career must become a permanent, searchable archive of leagues, domestic cups, the shared Champions Crown, players, clubs, managers, rivalries and record-breaking moments.

At the same time, remove the most visible immersion breaks around this area: contradictory result screens, horizontal overflow in Domestic Cups, cramped Office scrolling, and a tactics screen whose choices do not yet express a distinctive managerial identity.

### Experience pillars

1. **The world existed before the player.** Seed a deterministic founding archive for the season immediately before the career begins. Label it honestly as pre-career canon; never pretend those seasons were simulated.
2. **Every live result matters.** Current standings, cup holders, record matches and player leaderboards must come from real career data. Completed seasons remain permanently available.
3. **History is interactive.** Club crests, players and managers open their existing dossiers. Records are destinations, not dead text.
4. **Four domestic identities, one continental crown.** Each world presents its own top league, national cup and league cup. The Champions Crown remains the one shared competition across all four worlds.
5. **No empty states disguised as finished design.** If a record is not yet established, explain what will establish it and show the current chase. Never leave half a screen blank.
6. **Presentation serves information.** Use trophy cabinets, rank strips, editorial hierarchy, crests and existing portraits. Avoid repetitive white boxes, excessive gradients, clip-art answers or decorative noise.

### World History screen architecture

Build five views inside Season → Records:

- **Overview:** a world cabinet for Velmora, Kharova, Caldria and Ezuraya; reigning league, national cup and league cup holders; the shared Champions Crown holder; current career records; leaders and record chases.
- **Competitions:** filterable title lineage for each world and each trophy, including season, winner, runner-up or final context where the save contains it, and the current leader or active stage.
- **Players:** all-time and current-season leaderboards for appearances, goals, assists, average rating, player-of-the-match awards and discipline. Every row opens a player dossier.
- **Clubs:** honours counts, best league positions, biggest victories, unbeaten runs and record transfers, with live club links.
- **Managers:** the player-manager career record, AI manager standings, honours, win records, appointments and established rivalries, with live manager links.

Provide an internal navigation rail and a world filter that remain easy to scan at 1280×720 and above. The Records view should use the full Season canvas rather than retaining a redundant right sidebar.

### Data and simulation rules

- Read current results from the existing fixtures, statistics, competition history, club history, manager market, rivalry and career archive systems.
- Seed one deterministic pre-career season using the established clubs and world seed. It must always produce the same canon for the same career world.
- Prefer archived real champions over seeded holders as soon as a competition has completed in the player's career.
- Never invent completed live-season results.
- Store new tactical preferences additively so old saves load safely.
- Record milestone presentation must be idempotent: the same record cannot generate duplicate stories.

### Record-breaking presentation

When a new live match creates a biggest win, highest-scoring match, longest unbeaten run or record transfer, update the record book immediately. For a player-managed club, create an editorial news moment and a concise inbox acknowledgement where appropriate. The alert should explain the old mark, the new mark and who set it.

### Match-result coherence pass

- A non-zero score can never be paired with “no major events” or “defensive battle”.
- Presentation previews must generate a plausible scoring timeline and useful team statistics.
- Legacy results with missing scorer data should show a neutral team scoring record rather than inventing a named player.
- A genuine 0–0 should be labelled as a scoreless contest.
- Manager decision summaries must include all tactical dimensions that were actually changed.

### Tactical Identity V2

Expand the persistent match plan from three broad choices to six meaningful dimensions:

- Without the ball: Balanced, Press, Drop Back.
- With the ball: Balanced, Fast Break, Possession, Direct.
- Mentality: Defensive, Balanced, Attacking.
- Team width: Compact, Balanced, Wide.
- Tempo: Patient, Balanced, Urgent.
- Creative freedom: Structured, Balanced, Fluid.

Add three usable plan slots: Primary, Chase Game and Protect Lead. The manager can load a plan instantly and overwrite a slot with the current instructions. These choices must pass into the live match engine and alter spacing, support, directness, pressure, risk and energy cost. They must not be cosmetic labels.

### Layout and interaction quality

- Remove Domestic Cups horizontal scrolling at common desktop widths. All grid children must be shrinkable and responsive.
- Keep Office screens to one intentional page scroll wherever possible. Avoid a scroll area nested inside another scroll area unless the inbox master/detail layout requires it.
- Retain keyboard focus states, usable labels, minimum touch targets and semantic buttons.
- Respect all existing interface themes.
- Reuse existing badges, trophy art, player avatars, manager portraits and office artwork. No new sprite pack is required.

### Acceptance criteria

- Season → Records opens as a complete, full-width feature with five working views and a world filter.
- All four worlds expose a league, national cup and league cup holder; Champions Crown appears once as the shared continental honour.
- A first-season save contains labelled pre-career history rather than “to be crowned” placeholders.
- Real completed career seasons override the pre-career canon.
- Player, club and manager entries open their existing profiles.
- Current player leaderboards have at least six meaningful metrics and handle missing data honestly.
- The results preview never contradicts its score and contains a plausible event timeline and team statistics.
- The Domestic Cups hub does not create horizontal overflow at the supported desktop breakpoints.
- Six tactical dimensions and three plan slots persist safely and affect the live match engine.
- Automated integrity checks, the production build and visual browser QA pass without regressions.

### Non-goals

- Do not replace the existing simulation engine.
- Do not create a second parallel archive or duplicate player database.
- Do not fabricate unplayed current-season matches.
- Do not add new sprites solely to decorate this pass.
- Do not copy real-world league, cup or game branding.
