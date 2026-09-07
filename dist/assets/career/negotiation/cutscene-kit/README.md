# Negotiation cutscene compositing kit

This folder contains the production assets used to stage existing procedural characters inside the seven live negotiation shots. `negotiation-cinematic.js` combines these layers at runtime and falls back to the original accessible negotiation form if a required plate or furniture layer cannot load.

## Layer order

1. Existing location plate
2. Contact shadow
3. Procedurally rendered characters
4. Matching `*-foreground.png` furniture layer
5. Optional `camera-*-foreground.png` depth frame
6. Matching light overlay
7. Dialogue and negotiation controls

The foreground PNGs contain real transparency and retain source pixels from their corresponding 1672×941 plates. Place a full-body generated character in front of the chair or sofa and behind the foreground layer; the table and chair backs then hide the legs and create a seated composition without dedicated sitting sprites.

## Character reuse

- The player's manager uses the saved manager profile.
- The opposing manager uses the existing `managerMarket.managers` identity.
- Agents use the current manager creator with a session-stable random seed and one of the formal outfit IDs listed in `cutscene-kit.json`.
- Players continue to use their existing generated identity.
- Left/right staging uses the placement and `flipX` values in the manifest.
- The three camera foregrounds add left, right, and over-the-shoulder depth without creating character-specific art.

The current expression library already includes the required speaking states. `expression_00` is the neutral closed-mouth frame, `expression_09` is the open-mouth frame, and `expression_11` works as a listening/rest frame. Alternating those layers can suggest speech without regenerating a character.

## Files

- Seven scene-specific furniture foregrounds
- Three camera-depth foregrounds: left, right, and over-the-shoulder
- Two reusable contact shadows
- Boardroom and café lighting overlays
- `cutscene-kit.json` with formal agent wardrobe pools, expression states, and normalized placement suggestions
- `validate-cutscene-kit.cjs` for manifest, alpha, dimensions, wardrobe, expression, and checksum validation

## Validation

From this folder, run `node validate-cutscene-kit.cjs`. The validator reads only the manifest fields that are declared as image assets; speech timing arrays and other scene metadata are validated separately and are never interpreted as asset IDs. Inside the Velmora project it also verifies that every referenced expression and formal outfit exists. In a standalone extracted archive, that cross-project check is explicitly reported as skipped; pass `--project <path>` to validate against a separate Velmora checkout.

The generated segmentation mattes were used only to isolate source furniture. They are not shipped because the finished foreground PNGs already contain genuine alpha.
