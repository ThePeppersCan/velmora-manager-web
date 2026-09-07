# Velmora Personnel Character Pack v2

Five transparent, full-resolution character masters for recurring club personnel. They are designed to bridge the playful illustrated Inbox style and the cleaner presentation used by the Staff, Training and Career screens.

## Characters

| File | Role | Primary placements |
| --- | --- | --- |
| `chief-scout-raven.png` | Chief scout | Staff hub, scouting reports, transfer Inbox threads |
| `assistant-coach-badger.png` | First-team assistant coach | Training, tactics, team selection, dressing-room Inbox threads |
| `medical-lead-frog.png` | Head of medical | Staff hub, injury reports, player recovery and availability messages |
| `academy-director-fox.png` | Academy director | Youth Academy, prospect reports, academy Inbox threads |
| `commercial-director-lynx.png` | Commercial and club operations director | Staff hub, sponsorship, facilities, contracts and board-facing messages |

## Production specification

- Canvas: 1024 x 1536 PNG
- Background: genuine transparent alpha
- Framing: single character, three-quarter portrait, safe head and hand margins
- Intended display: approximately 96 px Inbox portrait to 320 px Staff feature art
- Treatment: use `object-fit: contain`; do not place the raw rectangle into a white avatar frame
- Small-size crop: favour head and shoulders using a wrapper with `overflow: hidden`, without producing a second identity image

## Shared generation prompt

> Use case: stylized-concept. Asset type: transparent character sprite for a premium PC sports-management game UI. High-resolution 2D hand-painted character illustration with a charming anthropomorphic fantasy-animal design, bold clean silhouette, controlled ink-like edges and soft painted texture. Premium Steam game polish. Harmonise with the cartoony hand-painted Inbox world without becoming literal low-resolution pixel art. Not photorealistic and not a 3D render. One character only, three-quarter standing portrait from mid-thigh upward, centred, entire head and hands visible, generous transparent padding, readable at both 96px and 320px. Warm clubhouse key light with a subtle cool rim light. Restrained navy, moss green, cream, muted gold and role-specific accents; no club crest. Genuine transparent background with clean alpha edges; no scenery, frame, pedestal, text, letters, logos, watermark, cropped ears, cropped hands, extra limbs or extra characters.

## Role direction

- Chief scout: black raven, navy field coat, muted-purple scarf, scouting notebook and binoculars.
- Assistant coach: sturdy European badger, moss-green training jacket, whistle and tactical clipboard.
- Head of medical: green tree frog with spectacles, cream sports-medicine coat, teal knitwear and medical satchel.
- Academy director: red fox, navy-and-gold tracksuit, youth-development notebook and pencil behind one ear.
- Commercial director: silver lynx, cream tailored jacket, navy waistcoat, gold details, tablet and contract folder.

These are fictional recurring club characters. They do not replace the player's custom manager portrait; save slots and manager-career screens should continue to render the player's chosen manager identity.
