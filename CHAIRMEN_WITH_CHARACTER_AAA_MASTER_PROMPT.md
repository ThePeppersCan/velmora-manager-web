# VELMORA MANAGER — CHAIRMEN WITH CHARACTER
## Advanced AAA/Steam Production Prompt

### Status and boundary

This document specifies a future implementation stage. Do not modify live gameplay, existing saves, club assignments, navigation, release metadata or deployment until implementation is separately authorised. The twelve sprites in `assets/career/chairmen-v1/` are dormant production assets.

## Product objective

Build a persistent ownership layer in which every club has an identifiable chairman, chairwoman or owner whose personality materially controls how that club behaves. The chairman must never be a decorative portrait attached to a generic Board screen. Their priorities must shape objectives, patience, financial policy, recruitment permissions, managerial interviews, job offers, contract negotiations, communication style and the consequences of broken promises.

The player should learn who an owner is through repeated decisions, not through a single archetype label. Two clubs with similar finances should feel different because one owner protects the academy, another demands immediate honours, another prioritises solvency, and another values public stature. The chairman becomes a recurring career character whose history with the manager can last across seasons.

Target quality: a polished premium PC career-mode system suitable for a commercial Steam release. It must be systemic, explainable, save-safe and authored in natural British English. Avoid repetitive pop-up boxes, arbitrary hidden punishment and generic AI-sounding prose.

## Non-negotiable design principles

1. **A person, not a modifier.** Every chairman has a name, portrait, age band, background, tenure, communication style, stated priorities, private concerns, risk tolerance and a persistent relationship with the manager.
2. **One authority model.** Objectives, job security, budgets, interviews and contracts must all consume the same chairman profile. Do not create unrelated personality systems for separate screens.
3. **Decisions leave history.** Appointments, promises, budget requests, public disagreements, trophies, relegations, sales and dismissals become durable relationship memories.
4. **Consequences are legible.** Before a major decision, communicate what the owner values and what is at risk. After it, explain which expectation changed and why.
5. **No personality roulette.** Identities remain stable. A cautious custodian does not become a reckless spender because a weekly random roll fired.
6. **No species determinism.** Portrait species and visual archetype help recognition but must not hard-code morality, competence or exact behaviour. Mechanical personality data is assigned independently and can create nuanced variations.
7. **Pressure develops over time.** A chairman may forgive a poor month after promotion or lose trust after repeated broken assurances. One result must not normally flip the whole relationship.
8. **Every club participates.** AI clubs use the same ownership logic for budgets, managerial appointments, sackings and strategic direction.

## Chairman identity model

Give every club a persistent `chairmanProfile` with a stable ID. Generate it deterministically for legacy careers and store it thereafter.

Required public identity:

- Full name and preferred title.
- Portrait asset and club-colour treatment.
- Age band and tenure start.
- Ownership background: local business, inherited dynasty, supporter trust, institutional investor, former athlete, entertainment group, technology wealth, industrial patron or civic consortium.
- Public reputation and one-sentence biography.
- Communication style: formal, direct, warm, guarded, theatrical, analytical or combative.
- Three visible priorities in ranked order.
- Current confidence in the manager with an evidence-based explanation.

Required behavioural dimensions, each stored on a 0–100 scale:

- Patience.
- Ambition.
- Financial caution.
- Sporting interference.
- Loyalty.
- Academy commitment.
- Infrastructure commitment.
- Star-player appetite.
- Commercial appetite.
- Supporter sensitivity.
- Reputation sensitivity.
- Negotiation flexibility.

Use dimensions rather than a single hard archetype. Archetypes provide readable starting distributions, while controlled variance prevents every chairman sharing the same answers.

## Twelve portrait archetypes

The initial art set contains twelve hand-authored pixel-art character silhouettes:

1. `chairman-01-dynasty-lion.png` — established dynasty presence.
2. `chairman-02-visionary-fox.png` — modern innovation and calculated growth.
3. `chairman-03-custodian-badger.png` — community stewardship and continuity.
4. `chairman-04-results-shark.png` — uncompromising performance pressure.
5. `chairman-05-sporting-stag.png` — sporting tradition and institutional standards.
6. `chairman-06-patient-owl.png` — evidence-led, long-horizon investment.
7. `chairman-07-populist-boar.png` — supporter emotion and public momentum.
8. `chairman-08-academy-hare.png` — youth pathways and internal development.
9. `chairman-09-global-peacock.png` — visibility, status and commercial reach.
10. `chairman-10-prudent-tortoise.png` — sustainability and controlled spending.
11. `chairman-11-patron-elephant.png` — patient backing and infrastructure.
12. `chairman-12-volatile-ram.png` — urgency, intervention and short-term demands.

These are visual casting options, not immutable behaviour classes. Create club-level distinction through deterministic names, biographies, tenure, club-colour accents, ownership backgrounds, priorities and behavioural values. Never recolour natural fur, feathers or skin to match a club. Limit club colours to restrained wardrobe accents, scarves, pins, folders and UI framing.

## Priority system

Each chairman has three ranked strategic priorities selected from:

- Win now.
- Qualify for the Champions Crown.
- Domestic cup prestige.
- Promotion.
- Survival and stability.
- Academy pathway.
- Develop valuable talent.
- Sign recognised stars.
- Recruit locally.
- Recruit young.
- Financial sustainability.
- Wage discipline.
- Trading profit.
- Stadium and facilities.
- Attractive attacking play.
- Defensive resilience.
- Supporter connection.
- Club reputation and commercial growth.

Translate these priorities into contextual objectives. Objectives must respect the club’s tier, current squad, finances, recent trajectory and competition access. Never demand impossible outcomes solely because the ambition value is high.

Each season should contain one defining objective, two supporting objectives, optional stretch targets with clear rewards, and one soft cultural expectation. Every objective displays the chairman’s reason, measurement, deadline, current status and effect on confidence.

## Patience and confidence

Replace opaque job-security movement with a chairman confidence ledger. Confidence is affected by weighted evidence:

- Results relative to club strength and agreed target.
- Direction of travel rather than isolated matches.
- Progress against strategic priorities.
- Treatment of promised players and academy prospects.
- Financial compliance.
- Transfer and wage decisions.
- Cup context and derby context.
- Press conduct involving the owner or board.
- Previous achievements and accumulated goodwill.
- Broken promises and repeated disagreement.

Patience controls the time horizon and volatility of evaluation, not simply the firing threshold. Patient owners examine longer samples. Volatile owners react earlier but still require credible evidence. Show a short explanation such as “Confidence fell because the wage ceiling was breached after you accepted it” instead of unexplained red arrows.

Support relationship states including First Impressions, Trusted Appointment, Working Alliance, Uneasy Partnership, Formal Warning, Fractured Relationship and Club Legend. States emerge from history and must not replace the numerical evidence underneath.

## Financial authority and budgets

Chairman policy determines initial transfer and wage envelopes, movement between categories, emergency funds, sell-to-buy rules, debt tolerance, infrastructure approval, academy and staffing protection, instalment tolerance, and the response to major sales or windfalls.

Budgets remain grounded in club finances. Personality changes allocation and permission; it never creates money from nowhere. A rich but cautious owner may retain reserves. An ambitious owner may advance future funds at the cost of later flexibility. Clearly identify recurring commitments and future liabilities.

Budget requests are contextual conversations, not generic yes/no modals. The manager may present a football case, financial case, academy case or urgent-risk case. The chairman’s answer cites their priorities, available finances and relationship history.

## Manager interviews and appointments

Every interview is led by the actual club chairman and reflects why the previous manager left, league position, squad age and hierarchy, financial constraints, supporter mood, chairman priorities and patience, and the candidate’s reputation and public history.

Questions test real disagreements: a restricted wage policy, protection of a named academy prospect, management of a powerful captain, or willingness to sell a star. Do not label one response as obviously correct. The strongest answer depends on the chairman, club and promises the candidate is prepared to keep.

Promises made during interviews enter the career ledger and are reviewed later. A convincing lie may win the job but damage trust if exposed. AI appointments use the same compatibility model, occasionally choosing prestige or urgency over ideal compatibility.

## Manager contract negotiations

Make the chairman an active negotiator. Talks may cover salary, length, performance bonuses, compensation, transfer and wage assurances, academy or infrastructure guarantees, staff control, sporting objectives and release permission for approaches from larger clubs.

Flexibility depends on finances, personality, candidate leverage, club desperation and relationship history. A chairman may improve salary while refusing control, offer a longer deal with stricter targets, or grant recruitment funds in exchange for a lower wage.

Do not use a hidden optimal package. Explain objections in character and retain prior concessions. Walking away, returning later or leaking talks may affect the relationship.

## Recurring interactions and memory

Create a bounded chairman memory ledger compatible with People & Power. Store structured facts rather than generated prose: appointments, contracts, promises, budget requests, major signings and sales, protected players, objective outcomes, public comments, formal warnings, trophies, promotions, relegations, resignations and dismissals.

Use these memories in later meetings, press questions, interviews and negotiations. Avoid constant interruptions: routine evaluation remains visible in the Board area; scenes are reserved for meaningful moments.

## Presentation and interaction

Use the existing pixel-art boardroom as the recurring location. Scenes use an establishing shot, chairman reveal, brief contextual exchange, two to four believable responses, and a clear reaction summarising promises, permission or risk.

Add a compact chairman dossier within Office/Board Expectations showing portrait, biography, tenure, priorities, communication style and recent confidence drivers. Names support hover and keyboard-focus context wherever they appear.

Use restrained animation: short sprite entrance, eye-line shift, document movement, focus lighting and subtle boardroom ambience. Respect reduced motion. Do not create lip-sync puppetry or distracting idle loops.

## Writing direction

- Use concise natural dialogue an executive might actually say.
- Give each communication style its own rhythm and vocabulary.
- Refer to specific clubs, players, competitions, finances and commitments.
- Avoid excessive commas, generic motivational phrases and moralised response labels.
- Never display safe, risky, correct or personality-match hints.
- Do not make difficult owners cartoon villains or supportive owners automatic benefactors.
- Keep humour rare and character-specific.

## World simulation

Chairmen govern AI clubs too. Their strategies influence manager retention, candidate selection, transfer aggression, squad age profile, academy usage, wage growth, facility investment and willingness to sell stars.

Ownership change is a rare explicit world event. A takeover creates a new persistent chairman, revised priorities, a transition period and a news trail. Never silently replace an owner during migration.

## Save compatibility and migration

- Add one versioned ownership schema.
- Deterministically generate identities for legacy clubs and store them thereafter.
- Preserve every existing budget, objective, manager contract and job-security value.
- Seed confidence from current board confidence rather than resetting it.
- Save assignments, identities, behaviour, relationship history, promises and tenure.
- Keep ledgers bounded and deduplicated by stable keys.
- Ensure export, import, local saves and cloud saves retain identical state.

## Performance and accessibility

- Load only the visible portrait, not all twelve full-resolution sources at startup.
- Create optimised runtime derivatives during implementation while retaining source PNGs.
- Alt text contains the chairman’s name and role, not species commentary.
- Every name and response supports keyboard navigation.
- Maintain readable contrast and visible focus.
- Honour reduced motion.

## Required testing

Automated checks must prove:

1. Every club receives exactly one stable chairman identity.
2. Different saves remain isolated.
3. Legacy migration preserves finances and board confidence.
4. Priorities drive objectives, patience, budgets, interviews and contracts through one profile.
5. Identical results produce different but explainable reactions under different chairmen.
6. AI clubs consume chairman policy without player-only shortcuts.
7. Promises and memories survive save/reload and cloud synchronisation.
8. Chairman changes occur only through explicit world events.
9. Negotiation concessions persist and cannot duplicate money.
10. No club can spend unavailable funds.
11. Chairman scenes close safely and restore their originating screen.
12. Portrait fallback, keyboard, reduced-motion and responsive layouts work.

Run at least fifteen simulated seasons. Audit appointments, dismissals, budgets, objective feasibility, takeover rarity and memory growth. Reject tuning that causes constant sackings, universal budget inflation or identical recruitment strategies.

## Definition of done

The stage is complete only when the player can name their chairman, understand what that person values, predict the broad logic behind their choices, disagree meaningfully and recall moments from the relationship. The same owner visibly influences objectives, patience, money, interviews and contract talks. The system creates stories without manufacturing noise, remains deterministic after reload and preserves every existing career.

Do not implement or deploy this specification until separately authorised.
