@echo off
setlocal
cd /d "%~dp0"

echo ============================================================
echo  Velmora Manager - commit V104 human-transfer routing fix
echo ============================================================
echo.

if not exist ".git" (
  echo ERROR: no .git folder here. Put this file in the Velmora Manager
  echo folder next to app.js and run it again.
  echo.
  pause
  exit /b 1
)

echo Current state:
git rev-parse --abbrev-ref HEAD
echo.

echo Creating branch fix/v104-human-transfer-routing ...
git checkout -b fix/v104-human-transfer-routing
if errorlevel 1 (
  echo.
  echo Branch already exists - switching to it instead.
  git checkout fix/v104-human-transfer-routing
  if errorlevel 1 (
    echo ERROR: could not switch branch. Nothing has been committed.
    pause
    exit /b 1
  )
)
echo.

echo Staging the four changed files ...
git add -- "multiplayer-client.js" "app.js" "tools/mp/mp_scenarios.cjs" "tools/mp/mp_fake_game.cjs"
if errorlevel 1 (
  echo ERROR: git add failed. Nothing has been committed.
  pause
  exit /b 1
)
echo.

echo Staged for commit:
git diff --cached --stat
echo.

git commit ^
 -m "Fix online manager-to-manager transfers being silently dropped" ^
 -m "applyEvent in multiplayer-client.js routed only WORLD_ACTION and TRANSFER to the bridge. HUMAN_TRANSFER_OFFER, HUMAN_TRANSFER_RESPONSE and HUMAN_TRANSFER_COMPLETE fell through to the default branch and were discarded on both devices, so an offer was claimed on the server, applied by neither client, and reported to the sender as a success it never became. The server was already correct: claim_world_action stores the kind verbatim and mp_sync projects kind, payload and actor_user_id." ^
 -m "Route the three human-transfer kinds alongside the existing two." ^
 -m "v104SubmitHumanTransferOffer now confirms the offer materialised locally before returning ok, instead of reporting success on a dropped event, and the offerId seed gained a monotonic sequence so a repeat bid at the same fee on the same date cannot collide on subject_key." ^
 -m "The path had no coverage: mp_scenarios only ever claimed TRANSFER and WORLD_ACTION, and the harness bridge was applyWorldAction(){return true;}, which ignored its arguments and could not detect a routing bug. The bridge now records every world action it receives, and a new scenario claims all three kinds across two sessions and asserts both devices received each one with actor_user_id and fee intact. Verified failing before the fix and passing after: 30 passed, 0 failed." ^
 -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" ^
 -m "Claude-Session: https://claude.ai/code/session_01EjaStkNJC9jcrKQPnPpx8h"

if errorlevel 1 (
  echo.
  echo ERROR: commit failed. See the message above.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo  Committed on branch fix/v104-human-transfer-routing
echo ============================================================
git log -1 --stat
echo.
echo To merge into master:
echo     git checkout master
echo     git merge fix/v104-human-transfer-routing
echo.
echo To undo this commit and go back:
echo     git checkout master
echo     git branch -D fix/v104-human-transfer-routing
echo.
pause
