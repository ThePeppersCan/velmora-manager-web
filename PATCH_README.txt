VELMORA MANAGER V89 — STABILISATION RELEASE

What this release does
- Consolidates the current gameplay and presentation under one V89 release identity.
- Includes the current manager creator and special-wardrobe work.
- Keeps the homepage, squad, academy, matchday, press, career and save systems together in one reproducible build.
- Aligns package, visible release and browser cache versions.
- Confirms transfer and contract saves before progressing, with failure recovery and stalled-write timeouts.
- Uses one responsive 16:9 stage for the main interface and negotiation cinematics.
- Ships browser screenshot baselines for laptop, desktop and wide-short layouts.
- Refreshes regression checks to the current UI without reverting newer working layouts.
- Verifies that every production runtime file in dist is identical to its source counterpart.

Release verification
Run `npm run verify` from the project folder. It rebuilds dist and runs the complete maintained regression suite.

Install
Use the contents of dist as the production build. Keep the folder structure intact so local assets and save support remain available.
