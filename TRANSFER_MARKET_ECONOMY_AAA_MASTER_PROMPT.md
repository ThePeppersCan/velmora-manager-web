# VELMORA MANAGER — TRANSFER MARKET ECONOMY & NEGOTIATION MASTER PROMPT

## Production objective

Deliver a premium, career-long transfer ecosystem suitable for a professional Steam management game. Every price, approach, counteroffer and contract demand must feel like the result of a living football world rather than a fixed percentage check.

The system must remain readable to the player without exposing formulas. It should communicate believable reasons — contract risk, importance, replacement difficulty, market competition, wage status and career ambition — while preserving uncertainty through scouting and private club valuations.

## Core design pillars

1. **One market truth**
   - Use one canonical career valuation for scouting estimates, seller negotiations, incoming bids, AI transfers, player exchanges and contract clauses.
   - Separate a player's benchmark market value from deal-specific leverage.
   - Prevent buy/sell arbitrage caused by different parts of the game using different price anchors.

2. **Contextual valuation**
   - Price current ability on a non-linear curve that preserves the existing Velmora economy.
   - Apply a smooth age curve rather than abrupt age brackets.
   - Reward unrealised potential most strongly for young players and taper it as players approach their peak.
   - Differentiate equal-overall players using the attributes most relevant to their role.
   - Include role-adjusted competitive output: appearances, ratings, goals, assists and player-of-the-match performances.
   - Include competition and club profile without allowing reputation to overwhelm ability.
   - Use the exact number of contract days remaining, with a gradual Bosman decline.
   - Keep temporary injury out of the public headline value; apply it to demand, risk and deal behaviour instead.

3. **Believable club negotiations**
   - Preserve club negotiator styles, patience, counteroffers, final positions, walkouts and cooldowns.
   - Seller leverage must account for squad role, starts, replacement depth, captaincy, financial pressure, rivalry, transfer status, market competition and window timing.
   - Do not double-apply contract or transfer-request discounts already contained in the benchmark value.
   - Give the player natural-language context cues without revealing hidden thresholds.

4. **Professional contract market**
   - A signed weekly wage remains fixed until a new contract is agreed.
   - Expected wages use current salary, ability-based market salary, destination level, club wage hierarchy, promised role, age and potential.
   - Breakout academy players and underpaid stars must recognise their new market standing.
   - Player personality, ambition, loyalty, home preference, agent style, contract term, signing bonus and squad role continue to affect acceptance.

5. **Structured transfer packages**
   - Support guaranteed fees paid upfront or across two or three instalments.
   - Support optional appearance and team-success add-ons with real trigger tracking.
   - Discount deferred and conditional money when a selling club judges an offer.
   - Retain sell-on percentages, player exchanges, release clauses, pre-contracts and loans with purchase options.
   - Persist outstanding obligations in career saves and show them in agreed-package summaries.

6. **Economic guardrails**
   - Keep normal incoming buyer ceilings near the established market range and reserve exceptional premiums for genuine competition, need or deadline pressure.
   - Never allow active bids or completed transfers to exceed available club funds.
   - Prevent duplicate payments, duplicate completed transfers and invalid obligation records.
   - Keep lower-league players affordable without flattening them all onto one minimum price.

7. **Presentation standard**
   - Scouting uncertainty remains intact: unknown players show ranges, not leaked ratings or exact formulas.
   - Negotiation screens surface concise market context such as contract leverage, squad importance, availability risk and buyer competition.
   - Copy should sound like a recruitment department or agent, not a tutorial or an algorithm.

## Acceptance criteria

- Buying, selling and AI negotiations use the same canonical benchmark value.
- A long contract is worth more than an expiring contract through a smooth day-based curve.
- A young high-potential player commands a meaningful but bounded premium.
- Strong performance increases value across every role; defenders are not punished for scoring fewer goals.
- Injury lowers demand and can alter leverage without erasing the player's headline value.
- Development never silently rewrites an active negotiated wage.
- Wage expectations respond to ability and the destination club's wage structure.
- Instalments and conditional add-ons survive save/load and pay exactly once.
- Existing exchange, sell-on, clause, loan, scouting and negotiation tests remain green.
- A dedicated transfer-economy regression test proves valuation consistency and financial integrity.

## Non-goals

- Do not replace the match engine.
- Do not reveal exact hidden acceptance percentages.
- Do not inflate the whole economy merely to make headline fees larger.
- Do not make every transfer possible; clubs and players must still reject unsuitable moves.
- Do not require new character sprites or abandon the existing negotiation cinematic.
