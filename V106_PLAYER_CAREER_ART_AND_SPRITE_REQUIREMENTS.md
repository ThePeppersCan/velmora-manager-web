# VELMORA MANAGER — PLAYER CAREER
## Art & Sprite Requirements
### V106 · Companion to `V106_PLAYER_CAREER_AAA_MASTER_PROMPT.md`

---

## Part 1 — What already exists (audited)

Before commissioning anything, note how much of this is already built.

### Player sprites — complete, reusable, zero new work

| Asset set | Path | Count | Size ceiling |
|---|---|---|---|
| Standing sprites | `assets/quidditch-engine/standing/player-XXX.png` | 1,609 | 124 × 90 |
| Flying / riding sprites | `assets/quidditch-engine/players/player-XXX.webp` | 1,609 | 154 × 82 |
| Portrait avatars | `assets/player-avatars/player-XXX.png` | 1,609 | — |

Pooled by region in `data/player-sprites.js`: **Velmora 1,105 · Kharova 168 · Caldria 168 · Ezuraya 168**. Validation report: 1,609 complete pairs, 4,836 images checked, 0 failures, 9 unpaired source characters.

### Manager modular rig — reusable for the head and face of a created player

1,101 validated transparent layer PNGs across 796 stable IDs:

- 128 face bases · 176 hairstyles · 40 facial-hair styles
- 16 eye shapes × 16 eye-colour palettes · 24 palette-swappable eyebrows
- 32 complexion overlays · 24 makeup options · 8 visual-age overlays
- 12 expressions · 24 jewellery · 16 hair accessories
- 200 outfits · 16 club-branding colour masks · 16 career-reward layers

**Critical:** club branding is already applied *at runtime through indexed colour masks*. Kit art never needs to be drawn per club — draw one neutral template, and all 288 clubs recolour it automatically. This is what makes the kit work below cheap.

Layer PNGs are tiny — roughly 1.0–1.8 KB each at portrait scale.

### Scenes and props — partly reusable

- 6 career room plates at 2.0–2.8 MB: `dressing-room` · `training-ground` · `office` · `boardroom` · `press-room` · `recruitment-room`
- 54 club uniform sheets in `assets/uniforms/`
- 25 props · 5 personnel portraits · chairmen, media, negotiation and staff sets

---

## Part 2 — The decision: how does the created player look?

Three paths. Pick before commissioning anything.

### Path A — Pooled sprite · **0 new assets**

The player picks a face from the 1,609 existing avatars, filtered by their chosen nation. The matching standing and flying sprites come free. The live engine needs **zero** changes.

*Ships in days. Cost: your character is one of 1,609, not yours.*

### Path B — Full modular creator · ~165 new assets

Reuse the entire manager head stack, add a playing-kit body layer set, and draw new in-match sprite bases so the created character genuinely appears on the pitch.

*The complete version. Cost: new in-match sprite bases at 124 × 90 / 154 × 82, which is the fiddliest art in the list.*

### Path C — Hybrid · **recommended for V106.0** · ~127 new assets

- **Modular creator** drives every portrait and cinematic surface: hub hero, teamsheet, dressing room, press, contract signing, results, milestones. This is where the player actually *looks* at their character, and it is where identity is felt.
- **In-match sprite**: pre-render the created character once at creation into the two required frames on an offscreen canvas and cache it. If compositing at that resolution proves fiddly, fall back to a pooled sprite auto-selected to match the created face's skin tone and hair.

*Ships the mode without blocking on the hardest art. Upgrade to Path B later without changing the save format — layer IDs are stored either way.*

---

## Part 3 — New assets required (Path C)

### 3.1 Player kit rig · ~50 layer PNGs

Drawn to the same anchor and scale as the existing manager outfit layers (~1.0–1.8 KB each), neutral and **mask-ready** so runtime club branding recolours them.

| Item | Count | Notes |
|---|---|---|
| Body bases | 6 | 3 builds × 2 heights, matched to the manager head anchor |
| Kit tops | 12 | Varied collars, sleeves, cuts — team-neutral |
| Kit bottoms | 6 | |
| Bracers / gloves | 8 | |
| Shin and arm guards | 6 | |
| Boots | 6 | |
| Squad-number back plate | 1 | Template only; numbers drawn with the existing matchday font |
| Captain's armband | 1 | |
| Training kit | 4 | |
| **Total** | **~50** | Travel and formal wear already covered by manager outfits |

### 3.2 In-match sprite bases · 12 — *Path B only, or Path C upgrade*

| Item | Count | Spec |
|---|---|---|
| Standing frames | 6 | ≤ 124 × 90, one per body base |
| Flying / riding frames | 6 | ≤ 154 × 82, one per body base |

Both must be layer-compatible so kit, skin and hair composite on top. **Skip for V106.0 under Path C.**

### 3.3 Scene plates · 9 · *the big immersion items*

Match the existing 2.0–2.8 MB career room style. Ranked by impact:

| # | Scene | Why it matters |
|---|---|---|
| 1 | **Teamsheet wall / dressing-room peg** | The single most important new moment in the release |
| 2 | **Tunnel, pre-kickoff** | The walk-out |
| 3 | **Physio / treatment room** | Injuries and rehab |
| 4 | **Personal gym / individual training** | The weekly loop |
| 5 | **Agent's office** | Contracts, approaches, transfer requests |
| 6 | **Player's home** | The life layer, sponsors, finances |
| 7 | **Trial pitch / academy ground** | The unsigned start path |
| 8 | **International call-up room** | The national-team layer |
| 9 | **Testimonial / retirement** | The payoff |

**#1 and #4 can crop from the existing `dressing-room.png` and `training-ground.png` for v1** — so **7 are strictly new**.

### 3.4 UI iconography · ~70 · **SVG, not PNG**

The codebase already inlines SVG paths (see the icon set at the top of `player-traits.js`). Follow that pattern — cheaper, sharper, theme-aware.

| Set | Count |
|---|---|
| Position badges — ATTACKER, PLAYMAKER, DEFENDER, ALL-ROUNDER | 4 |
| Squad-role ladder — Reserve → Rotation → Prospect → Important → Crucial | 5 |
| Manager-trust meter states | 5 |
| Selection stamps — STARTING · BENCH · NOT IN SQUAD | 3 |
| Milestone badges | ~20 |
| Lifestyle icons | 6 |
| Relationship-state icons | 6 |
| Sponsor marks — fictional, trademark-safe | 12 |
| Injury and rehab icons | 6 |
| **Total** | **~70** |

**Milestone badge list:** debut · first start · first goal · first assist · first hat-trick · 10 / 50 / 100 / 200 appearances · 50 career goals · Player of the Match · captaincy · first honour · promotion · first international call-up · first cap · relegation survived · comeback from long injury · testimonial · retirement · hall of fame.

### 3.5 Optional polish · defer past V106.0

- Celebration poses — 4
- Portrait frames per squad-role tier — 5
- International kit templates — 16 nations, or 2 templates recoloured at runtime by nation

---

## Part 4 — Totals

| Build | Kit layers | Sprite bases | Scene plates | Icons | **Total** |
|---|---|---|---|---|---|
| **Path A** — pooled sprite | 0 | 0 | 7 | ~70 | **~77** |
| **Path C** — hybrid *(recommended)* | ~50 | 0 | 7 | ~70 | **~127** |
| **Path B** — full modular | ~50 | 12 | 9 | ~70 + polish | **~165** |

The icons are SVG and cheap. The real commissioning cost is **7 scene plates** and, under Path B/C, **~50 small kit layers** — which are 1 KB portrait-scale pieces in an established rig, not new artwork from scratch.

---

## Part 5 — Constraints for whoever draws these

- **Trademark-safe and team-neutral.** No real-world clubs, sportswear brands, logos or wordmarks. Club identity is applied at runtime through indexed colour masks — never bake it into the art.
- **Transparent PNG**, matching the existing layer alpha and margin conventions (frame margin minimum 6 px per the sprite validation report).
- **Anchored to the existing manager rig.** A new body layer that does not line up with the 128 face bases is unusable.
- **Mask-ready.** Kit pieces need clean indexed regions for primary / secondary / accent recolouring.
- **Size ceilings are hard.** 124 × 90 standing, 154 × 82 flying — the live engine's `drawSprite` / `playerSpriteHeight` depend on them.
- Run new sprites through `tools/player_sprite_transparency.py` and `tools/rebuild_player_sprites.py`, and update `data/player-sprite-manifest.json` and the validation report, exactly as the existing pipeline does.

---

## Part 6 — Housekeeping flag

`assets/manager/outfits/outfit_special_liverpool_third.png` names a real football club and is 34 KB against the ~1.3 KB norm for that folder. It contradicts the pack README's explicit promise that pieces are "deliberately team-neutral and trademark-safe: no real-world sportswear names or logos are embedded."

Unrelated to this feature, but it sits inside the rig Player Career will reuse — worth removing or renaming before any wider release.
