# VELMORA MANAGER — PEOPLE & POWER

## AAA production brief

Build a persistent social simulation in which a manager’s public words and private squad structure remain part of the career for months, alter later decisions, and create believable context without exposing a simple “correct answer”. The feature must feel native to an elite PC career-mode game: legible, dramatic, systemic, save-safe and restrained.

### Product pillars

1. **People remember the manager, not merely the event.** Every meaningful press answer can become a named memory attached to a player, opposition manager or reporter. Memories have tone, strength, date, source and a natural lifespan. Strong moments may return in later coverage, private briefings, transfer talks and contract discussions.
2. **The dressing room has a social shape.** Players occupy a hierarchy and form evolving groups through captaincy, leadership, age, shared background, positional competition, tenure and actual relationship events.
3. **Consequences travel through relationships.** Praise or criticism of one player can reach friends and group leaders. Removing a captain or selling a leader affects their circle. A major signing can displace an established starter and create credible competition.
4. **Never turn personality into a puzzle wheel.** Do not reveal raw success percentages or label one response as morally correct. Surface observable context—public tension, trusted access, leadership standing, cohesion—then let the player judge risk.
5. **Career continuity over random drama.** A later callback must cite a real saved comment, transfer, captaincy change or relationship. Never invent a feud merely to fill a panel.

## System specification

### Persistent public memory

- Store named memories for `PLAYER`, `MANAGER` and `REPORTER` people.
- Each memory requires: stable ID, career date, expiry date, season, club, person identity, source, summary, valence, strength, linked press statement, fixture and callback state.
- Use graded decay. Ordinary remarks fade in roughly two to five months; headline-level praise, broken promises and public insults can last most of a season.
- A person can hold several memories. Calculate the current relationship context from all active memories with recency decay rather than replacing the last result.
- Preserve older expired memories as an archived public record while keeping the live simulation bounded.
- Generate rare, deterministic callbacks after enough career time has passed. The callback must quote or paraphrase the saved statement and explain why it matters now.

### Press-conference integration

- Record a player memory whenever a named player is discussed, including opposition players.
- Record a manager memory for rivalry and opposition-manager questions.
- Record a reporter memory when access changes, a headline is created, or an exchange is marked for follow-up.
- Show prior history in the question context: examples include `PUBLIC TENSION`, `RESPECTFUL PUBLIC HISTORY` and `WORDS ON RECORD`.
- After an answer, acknowledge only the most important immediate reactions. Avoid a wall of stat deltas.
- A player’s close group should react subtly to strong praise or criticism. The named player remains the primary consequence.

### Transfer and contract integration

- Praise of a future transfer target may create modest trust and reduce negotiation friction. Public criticism should make the target and their representatives more guarded.
- An opposition manager with a serious public grievance may demand a premium, lose patience more quickly, or temporarily refuse discretionary talks.
- A release clause remains a legitimate route because it removes the selling club’s discretion.
- Public history must remain a secondary influence. Ability, contract, club status, competition, budget and squad role still dominate valuation and terms.
- Explain resistance in natural language. Never show “-8% because of press answer”.

### Squad hierarchy

- Rank the squad into captain, leaders, core voices, followers, new arrivals and peripheral players.
- Leadership derives from personality, age, squad status, captaincy and lived career context.
- Recalculate the shape periodically and after transfers or captaincy changes.
- A captaincy change should strengthen the new captain, affect their allies and potentially unsettle a displaced senior leader.
- When a leader leaves, their closest group can suffer a short, limited emotional response.

### Cliques and relationships

- Build small, readable social groups using shared role, age, country/world, personality compatibility, academy background and saved pair relationships.
- Existing friendships and mentorships strengthen affinity. Rivalries, conflicts and unresolved incident tension weaken it.
- Groups require a clear identity such as `LEADERSHIP CIRCLE`, `NEXT GENERATION`, `SENIOR CORE`, `NEW ARRIVALS` or a positional unit.
- Do not imply that every clique is harmful. Most groups are ordinary support networks.
- Cohesion is a descriptive squad-level result, not a direct win modifier.

### Displaced starters

- When a credible new arrival overlaps an established player’s role and level, mark the incumbent as under pressure.
- Create a competitive pair relationship and a small trust/morale response for important incumbents.
- Surface the situation in Squad Dynamics and the player story panel.
- Resolve or cool the situation naturally through selection, transfers and later relationship events; do not permanently brand a player after one signing.

## User experience

Add a dedicated **Squad → Dynamics** view using the game’s established dark teal career presentation and existing player art. It must contain:

- a strong cohesion and atmosphere header;
- a hierarchy ladder with captain and leading voices;
- group cards showing members, group voice and cohesion;
- live fault lines based only on saved relationship tension;
- displaced starters and their challengers;
- active public comments currently circulating in the squad.

Player names must open the existing full player profile. The player profile’s Career section must include a public-record timeline. Press rooms should show a reporter’s prior history unobtrusively beside their identity.

No new character sprites are required. Reuse the established player avatars, standing sprites, manager paperdolls, reporter portraits and club identity art. Spend production effort on composition, hierarchy, feedback and systemic depth rather than duplicate assets.

## Balance guardrails

- Clique cascades are smaller than the named player’s reaction and capped to a few close teammates.
- Public history can influence negotiations but cannot override affordability, role demands or release clauses.
- Avoid weekly notification spam: at most one memory callback can surface per weekly processing pass.
- Keep persistent collections bounded and migration-safe.
- Ensure deterministic grouping and callbacks for the same save state.
- Do not alter match simulation or award hidden performance bonuses based on social labels.

## Accessibility and performance

- Support keyboard focus and the existing unified player-profile interaction.
- Use text labels in addition to colour for positive, neutral and negative memory states.
- Respect reduced-motion preferences.
- Keep hierarchy calculation practical for the thirteen-player senior squad and avoid asset downloads or new network dependencies.

## Acceptance criteria

- Existing careers load without reset and migrate to the new media and clubhouse state versions.
- A named press answer creates the correct person memory and survives save/load.
- Strong comments can produce a future career callback after meaningful elapsed time.
- Opposition-manager history changes seller posture in a later transfer negotiation.
- A previously discussed player carries that context into personal terms.
- Captaincy changes and transfers affect relevant social groups with bounded consequences.
- Squad Dynamics renders hierarchy, multiple social groups, tension, displaced starters and live public memory from actual save data.
- Player profiles expose archived and active public comments.
- No new sprites are required, no match engine is rewritten, and all dedicated regression tests pass.
