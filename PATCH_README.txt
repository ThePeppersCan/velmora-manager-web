VELMORA MANAGER V68 — RELEASE CANDIDATE

What this release does
- Preserves the current V68 gameplay and presentation as the release-candidate baseline.
- Includes the current manager creator and special-wardrobe work.
- Keeps the homepage, squad, academy, matchday, press, career and save systems together in one reproducible build.
- Aligns package, visible release and browser cache versions.
- Refreshes regression checks to the current UI without reverting newer working layouts.
- Verifies that every production runtime file in dist is identical to its source counterpart.

Release verification
Run `npm run verify` from the project folder. It rebuilds dist and runs the complete maintained regression suite.

Install
Use the contents of dist as the production build. Keep the folder structure intact so local assets and save support remain available.
