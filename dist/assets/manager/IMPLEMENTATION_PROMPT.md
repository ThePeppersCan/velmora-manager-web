# Implementation prompt — integrate the Velmora Manager customization expansion

You are modifying the existing Velmora Manager game/application. Inspect the project before editing it. Integrate the supplied asset pack as an extension of the current manager creator and in-game manager renderer. Do not replace established screens, routes, simulation rules, database content, city/country canon, or existing save systems. Preserve every existing stable asset ID and make old saves load without visible regressions.

## Source of truth

- `manager-assets.json` is the authoritative asset manifest.
- `configs/wardrobe-presets.json` defines wardrobe slots and their intended scenes.
- `configs/randomization-profiles.json` defines safe randomization profiles and controls.
- `configs/identity-options.json` defines pronouns and titles.
- `configs/age-rules.json` defines optional visual-age mapping.
- `configs/scene-rules.json` defines scene-to-wardrobe and event-to-expression mappings.
- All PNGs are transparent 256×384 nearest-neighbour pixel layers made on a 128×192 working grid.
- Do not rescale individual layers independently. Scale the finished composite only, using integer or nearest-neighbour scaling.

## Backward compatibility

1. Keep all current asset IDs and their meaning unchanged.
2. Existing `face.path` files include their legacy eyes and eyebrows and must remain the fallback for schema-v4 saves/renderers.
3. The new modular renderer must use `face.separatedPath`, then render selected eyes and eyebrows. Never draw modular eyes/brows over a legacy face path.
4. Migrate missing new fields with the defaults in `manager-assets.json`; do not rewrite or discard old selections.
5. Unknown/missing IDs must fall back to defaults and log a non-fatal warning.
6. Store a `managerAppearanceSchemaVersion` with saves. Set new or migrated records to 5 only after successful normalization.

## Exact render pipeline

Render in this order:

1. CSS/game-engine shadow (not baked into the sprite)
2. hair back
3. body/skin
4. selected outfit
5. selected team-branding overlay, recoloured and clipped to the selected outfit alpha
6. separated face base
7. eye shape recoloured with `eyePaletteId`
8. eyebrow shape recoloured with `eyebrowPaletteId` (usually the hair palette)
9. expression: erase the eye/brow/mouth zones with `eraseMask`, then draw the expression overlay; skip normal eyes/brows while a non-neutral expression is active
10. complexion/face-detail overlay
11. age overlay
12. makeup overlay
13. facial hair recoloured with the chosen facial-hair/hair palette
14. eyewear
15. hair front
16. universal hair accessory
17. jewellery
18. existing handheld/general accessory
19. career reward

For Canvas 2D, use an offscreen 256×384 canvas. To apply an expression mask, draw the mask with `globalCompositeOperation = "destination-out"`, restore `source-over`, then draw the expression. For team branding, recolour the indexed source colours, draw it to a temporary canvas, and multiply its alpha by the selected outfit alpha before compositing.

## Indexed colours

- Hair and eyebrows use the four indexed hair colours already defined by the manifest.
- Eyes replace source `#2E8499` with the selected eye palette colour.
- Team branding maps `#FF00B4` to club primary, `#00E2E2` to club secondary, `#FFCD36` to accent, and `#F4F1E5` to the club-neutral light colour.
- Vitiligo entries use skin-relative rendering. Derive light and edge tones from the active skin palette instead of treating their preview RGB values as universal.
- Cache recoloured layers by `assetId + paletteId + clubColourHash` to avoid per-frame pixel work.

## Expanded manager save shape

Normalize manager appearance data to this shape (adapt naming to the existing code style without losing fields):

```json
{
  "managerAppearanceSchemaVersion": 5,
  "identity": {
    "name": "",
    "preferredShortName": "",
    "age": 36,
    "pronounId": "pronoun_they_them",
    "customPronouns": null,
    "titleId": "title_coach",
    "nationId": null,
    "cityId": null
  },
  "appearance": {
    "skinId": "skin_01",
    "faceId": "face_01",
    "eyeId": "eye_01",
    "eyePaletteId": "eye_brown",
    "eyebrowId": "eyebrow_01",
    "eyebrowPaletteId": "hair_dark_brown",
    "complexionId": "complexion_00",
    "makeupId": "makeup_00",
    "ageOverlayId": "age_overlay_00",
    "hairId": "hair_01",
    "hairPaletteId": "hair_black",
    "facialHairId": "facial_hair_00",
    "facialHairPaletteId": "hair_black",
    "eyewearId": "eyewear_00",
    "jewelleryId": "jewellery_00",
    "hairAccessoryId": "hair_accessory_00",
    "accessoryId": "accessory_00",
    "careerRewardIds": [],
    "autoVisualAgeing": false,
    "autoGreyHair": false
  },
  "wardrobePresets": {
    "matchday": {},
    "training": {},
    "press": {},
    "office": {},
    "casual": {},
    "formal": {},
    "wet_weather": {},
    "celebration": {}
  },
  "activeWardrobePresetId": "office",
  "clubBranding": {
    "clubId": null,
    "primary": null,
    "secondary": null,
    "accent": null,
    "badgePath": null,
    "initials": null,
    "overlayId": "team_overlay_00"
  },
  "expressionId": "expression_00"
}
```

Each wardrobe preset must be a complete snapshot of outfit ID, team overlay, jewellery, hair accessory, eyewear, general accessory and visible career reward. Let the user copy one preset to another, reset one preset, or apply the active look to all presets. Editing one preset must not silently mutate the others.

## Creator user experience

- Add tabs or grouped controls for Face Detail, Eyes, Eyebrows, Makeup, Age Detail, Jewellery, Hair Accessories and Career Rewards.
- Keep all appearance choices available to every manager. Pronouns, title, face presentation tags and clothing must never restrict one another.
- Provide `Randomize all`, `Face only`, `Hair only`, `Clothes only`, and `Details only` actions.
- Add a lock control to every group. Randomization must leave locked groups unchanged, use a seed when supplied, respect valid IDs/compatibility, and never select a career-locked reward.
- Expose profile choices from `randomization-profiles.json`, plus Complete Random.
- Show the selected eye and hair colours as swatches. Do not generate duplicate asset cards for palette variants.
- Add optional `Visual ageing follows career age` and separate `Allow automatic greying` toggles. Manual choices always win.
- Add name, short name, age (18–80), pronoun and title fields. Use name-based fallback language if custom pronoun grammar is incomplete.
- Treat labels such as masculine, feminine and unisex as optional discovery tags only; they are not restrictions.

## Scene-specific wardrobe and expressions

- Resolve scene wardrobe through `configs/scene-rules.json`, then `activeWardrobePresetId`, then the manifest default.
- Match/touchline uses Matchday; training/academy uses Training; press/media uses Press; inbox/board/staff/scouting uses Office; hub/travel uses Casual; contracts/gala/awards use Formal; rain/snow uses Wet Weather; trophy/promotion uses Celebration.
- Event expressions are transient UI/game state. Neutral is the persisted default. A goal, loss or hostile press answer must not permanently alter the manager's saved creator face.
- Crossfade or switch completed composites; never interpolate individual pixel layers.
- Preload the active scene, neutral expression and likely adjacent expression layers to avoid flashes.

## Team wardrobe system

- Before a club is selected, use `team_overlay_00` and show neutral clothing.
- After club selection, recolour only the selected branding overlay from the indexed club palette and clip it to the outfit alpha.
- If the game already has real club badge artwork, render that badge in the defined chest anchor as a separate clipped layer. Do not bake or copy badge files into these generic assets.
- If no badge exists, render club initials in the established pixel font. Cache the result.
- Do not put real-world sportswear logos, Nike names/Swooshes, or copied trademark shapes into the game. The supplied clothing already provides modern technical sportswear silhouettes in a team-neutral system.
- Changing clubs must immediately update colours/badge while keeping the manager's chosen outfit and presets.

## Visual ageing and career rewards

- Auto-age mode derives the age overlay from the current age bands only when the user has not pinned a manual overlay.
- Age the manager at the same point the existing career calendar increments age. Do not age them on every render.
- Hair greying is suggestion-only unless both auto toggles are enabled; never destroy the user's original palette choice. Store it as `manualHairPaletteId` for restoration.
- Evaluate career reward conditions after match/career-stat updates and on save load. Unlocks are permanent once earned.
- The creator may preview locked rewards, but locked entries must be visibly marked and cannot be equipped.
- Default to one visible career reward at a time even if several are unlocked; preserve all unlocked IDs separately.

## Content and canon protection

- Do not rename or invent countries, cities, clubs, leagues, competitions, people or historical results.
- Reuse the project's existing nationality/city datasets and validation.
- Do not replace current match simulation, tactics, finances, inbox, scouting, progression or navigation logic.
- Do not remove existing accessibility, keyboard, responsive or reduced-motion behaviour.
- Keep creator state local until Save/Continue; Cancel must restore the last committed appearance.

## Required tests

Add automated tests where the project supports them, plus complete a manual smoke test:

1. Load a pre-schema-5 save: its old face looks unchanged.
2. Migrate and save it: reload produces the same selected manager.
3. New face mode shows exactly one pair of eyes and one pair of eyebrows.
4. Every manifest path exists and every layer is 256×384 RGBA.
5. All 796 selectable stable IDs are unique.
6. Each eye colour and hair/eyebrow palette recolours only its indexed pixels.
7. Team overlay pixels never appear outside the selected outfit alpha.
8. Club switching updates branding without changing the outfit ID.
9. All eight wardrobe presets save/reload independently and scene mapping selects the expected one.
10. Transient expressions return to neutral after the scene/event ends.
11. Randomization respects locks, seeds and career unlocks.
12. Age 18 and 80 resolve to valid overlays; manual age detail is not overwritten.
13. Pronouns/titles never hide or disable appearance choices.
14. All original routes and gameplay systems still work.
15. Creator works at desktop and mobile widths with keyboard focus visible.

Finish by reporting changed files, migration behaviour, test results, and any existing project limitations. Do not claim completion unless the legacy-load, independent-preset, clipping and save/reload tests pass.
