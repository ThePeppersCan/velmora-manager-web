# VELMORA MANAGER — FOUR AUDIENCES & DELAYED DILEMMAS

## Production mandate

Act as a senior career-mode game director, systems designer, narrative designer, economy designer, UI/UX lead and QA owner shipping a premium PC management game. Upgrade the existing Club Pulse. Do not replace it with a disconnected feature and do not reduce the work to four coloured confidence bars.

The player manages one club while four audiences continuously interpret the same career from different positions:

- Board: delivery against the owner’s mandate, financial control, institutional conduct and promises made upward.
- Dressing room: selection fairness, private honesty, hierarchy, protection, public comments and promises kept to players.
- Supporters: results, ambition, club identity, star-player decisions, academy pathways and whether the manager appears to understand the club.
- Press: credibility, access, consistency, quotable claims, evasions, relationships with individual reporters and whether old statements survive contact with later events.

Each audience must own a separate persistent memory ledger. A decision may be admired by one audience and resented by another. Memory must include the original date, context, subject, choice, strength, emotional direction, decay horizon and any later consequence that reinterpreted it. Never derive all four audiences from one hidden approval value.

## Player experience target

Club Pulse should answer three questions at a glance:

1. How does each audience currently feel?
2. What specific moments caused that view?
3. Which past choices are still developing?

The Central card remains compact and readable. It expands from three to four audiences and surfaces the most relevant current memory. Selecting an audience opens a premium dossier containing that audience’s own recent history. The dossier must make disagreement between audiences legible without exposing game formulas.

## Delayed-dilemma contract

Some decisions create an unresolved thread. Record the answer immediately, but do not announce a correct or incorrect choice. Resolve the thread between roughly one and six in-game weeks later, using the career state at that later date: form, selection, player trust, dressing-room atmosphere, press access and whether the manager’s follow-through made the original words credible.

The immediate response should say that the decision is recorded and consequences remain in motion. Avoid green/red morality feedback and avoid labels such as “best answer.” When the thread matures, deliver a natural follow-up through the inbox, media, boardroom or dressing room. Explain what changed in the world and how each relevant audience now interprets it. A mixed verdict is valid and often preferable.

Delayed consequences must:

- survive saving, loading and legacy-save migration;
- resolve deterministically from saved state, never reroll on reload;
- never block unrelated career progression;
- remain bounded in memory and save size;
- coexist with existing player promises, press memories, chairman behaviour, cliques and unexpected events;
- never introduce fake delays into transfer-fee negotiations;
- use existing art and presentation systems unless a genuinely missing asset is identified.

## Required systemic connections

- Career decisions write audience-specific first impressions.
- Bad-run and good-run messages are judged again after subsequent results.
- Captain and training-ground dilemmas are judged against later dressing-room atmosphere.
- Transfer-request conversations are judged against the player’s later status and trust.
- Media answers and full press conferences can become callbacks whose meaning changes with results and press access.
- Chairman expectations remain authoritative for board mechanics, while the Club Pulse board ledger explains the lived history behind that relationship.
- Resolved delayed outcomes can make small, proportionate mechanical changes, but the main value is persistent context and future reactivity.

## Writing and presentation standards

Write concise, believable career-mode language. Use concrete subjects and actions. Avoid generic coaching slogans, fake profundity, excessive commas, repetitive “back the group / speak from the heart” phrasing and instant tooltips that disclose the optimal answer. The UI should feel editorial and premium: restrained motion, high information density, keyboard access, responsive layouts and a reduced-motion path.

## Acceptance criteria

- Four audience stores exist for every active club and never share a memory array.
- Each audience can display at least four distinct recent memories.
- Club Pulse includes Board, Dressing Room, Supporters and Press.
- Decisions can create one saved unresolved thread and one later saved resolution.
- Reloading before resolution does not alter its due date or identity.
- A later outcome may split audiences rather than applying one universal result.
- Existing saves migrate safely with distinct opening-context memories.
- Memory ledgers and outcome archives have strict caps.
- Automated tests cover independence, persistence, delayed resolution, no instant verdict and legacy migration.
- The production build and visual regression suite pass.

Ship this as an integrated career-system release, not a prototype or a cosmetic mock-up.
