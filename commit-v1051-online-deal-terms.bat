@echo off
setlocal
cd /d "%~dp0"
echo ============================================================
echo  Velmora Manager - commit V105.1 online deal terms
echo ============================================================
echo.
if not exist ".git" (
  echo ERROR: no .git here. Put this file in the Velmora Manager folder.
  pause & exit /b 1
)
git rev-parse --abbrev-ref HEAD
echo.
echo Creating branch feature/v105-1-online-deal-terms ...
git checkout -b feature/v105-1-online-deal-terms || git checkout feature/v105-1-online-deal-terms || (echo ERROR: branch failed. & pause & exit /b 1)
echo.
echo Staging ...
git add -- "app.js" "career-expansion.js" "multiplayer-core.js" "multiplayer-client.js" "styles.css" "package.json" "tools/test_v105_1_online_deal_terms.cjs" "tools/mp/mp_scenarios.cjs"
if errorlevel 1 (echo ERROR: git add failed. & pause & exit /b 1)
echo.
git diff --cached --stat
echo.
git commit ^
 -m "Carry full deal terms across an online manager-to-manager transfer" ^
 -m "The V34/V35 deal system - sell-on, swaps, instalments, add-ons, wage share, buy options - refuses to work with a human-controlled club and redirects to 'the standard transfer offer'. That offer was fee-only with a binary accept or reject, so an online career negotiated a number where an offline one negotiated a package." ^
 -m "An online offer now carries the same validated term contract an offline one does. career-expansion exposes normalTerms and termsValid so a deal is legal by one definition whoever is being negotiated with." ^
 -m "Adds HUMAN_TRANSFER_COUNTER. Either manager can revise the package: the seller answers the opening terms, the buyer answers a counter. The offer tracks which side is awaited and which round it is on, the round is part of the subject key so a round cannot be written twice, and a replayed event is absorbed rather than refused. Bounded at 12 rounds so a save cannot grow without limit." ^
 -m "Fixes a latent bug: v104ApplyTransferComplete moved the player itself and never ran the sell-on settlement, so a clause agreed anywhere was silently lost the moment that player changed hands in a shared career. It now calls onTransfer before writing the new clause, and refuses a registration whose sell-on does not match what the seller approved." ^
 -m "Instalments, add-ons and swaps are carried but deliberately not settled online: they resolve over days against club budgets and two devices processing that independently would drift apart. The offer builder says so rather than silently dropping them. Putting the payment schedule in the shared world is the follow-up." ^
 -m "Tests: two transport scenarios for counter routing and round idempotency (32 passed), and tools/test_v105_1_online_deal_terms.cjs driving the real handlers through a countered negotiation, turn enforcement, replay, and a sell-on that is recorded, honoured on a later sale, and paid when a player carrying one moves through an online registration. Each was verified failing before its fix." ^
 -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" ^
 -m "Claude-Session: https://claude.ai/code/session_01EjaStkNJC9jcrKQPnPpx8h"
if errorlevel 1 (echo. & echo ERROR: commit failed. & pause & exit /b 1)
echo.
echo ============================================================
echo  Committed on feature/v105-1-online-deal-terms
echo ============================================================
git log -1 --stat --no-pager
echo.
echo Merge:   git checkout master ^&^& git merge feature/v105-1-online-deal-terms
echo Undo:    git checkout master ^&^& git branch -D feature/v105-1-online-deal-terms
echo.
pause
