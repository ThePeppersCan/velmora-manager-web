@echo off
setlocal
cd /d "%~dp0"
echo ============================================================
echo  Velmora Manager - commit V107 player career shell
echo ============================================================
echo.
if not exist ".git" (
  echo ERROR: no .git here. Put this file in the Velmora Manager folder.
  pause & exit /b 1
)
git rev-parse --abbrev-ref HEAD
echo.
echo Creating branch feature/v107-player-career-shell ...
git checkout -b feature/v107-player-career-shell || git checkout feature/v107-player-career-shell || (echo ERROR: branch failed. & pause & exit /b 1)
echo.
echo Staging ...
git add -- "app.js" "index.html" "velmora-quidditch-engine.js" "player-career.css" "player-career-shell.css" "release-meta.js" "career-bootstrap.js" "tools/test_v107_player_career_shell.cjs" "tests/v107-player-career-shell.spec.cjs" "tools/test_v106_player_career.cjs" "tests/v106-player-career.spec.cjs"
if errorlevel 1 (echo ERROR: git add failed. & pause & exit /b 1)
echo.
git diff --cached --stat
echo.
git commit ^
 -m "Run Player Career inside the manager shell, and give the athlete a player's authority" ^
 -m "V106 shipped Player Career on bespoke screens - screenPlayerHub and screenPlayerTeamsheet - with their own dark palette, their own top bar and their own layout. Beside Manager Career it read as a different game. Both screens are retired. Player Career now runs on the real career screens: Central, Squad, Matchday, Season and Office, with the same chrome relabelled CENTRAL / TEAM / MATCHDAY / SEASON / MY CAREER." ^
 -m "Central keeps its calendar, advance panel, fixture hero, news and club pulse. Board expectations becomes Your standing - manager trust, sharpness, condition. Club finances becomes Your contract. The snapshot becomes Your season. MY CAREER is the Office shell carrying Inbox, My Standing, Contract, Interest and Career Record, dressed in the Office's own pixel language so it reads as the same product." ^
 -m "Fixes half-time. beginHalftime was only ever reached when state.management existed, and initMatchday sets that to null in player mode, so a watched player-career match ran one continuous half, never broke at the interval and never ended cleanly. The interval is now keyed on careerHalvesEnabled() - management or playerMode - and player mode runs the broadcast package then restarts itself, because the athlete has no changes to make. Exhibition and multiplayer matches are untouched." ^
 -m "Authority is now enforced, not merely hidden. Every route into the user club's line-up passes through pcSquadEditBlocked: moveLineupPlayerToSlot and swapLineupPlayers, beginSwap, the card-click swap gesture, drag start, drop and the empty-slot click. The club AI keeps its own path through an explicit system flag, so the manager still names the side. Tactics, training and the academy refuse to open. The athlete can study the team and inspect any player; they cannot pick it." ^
 -m "The mailbox is now addressed to the player. A manager's inbox is a desk - board notices, scouting dossiers, finance memos, other players' contracts - none of it written to an athlete. buildOfficeMessages branches to a player mailbox that keeps only mail carrying audience PLAYER, a PC_ decision, or the athlete's own id. It adds live briefings from the manager, the club physio and the performance staff, plus a named representative seeded from the world. Team sheets, post-match reviews, injuries, clearances, trust movements and formal approaches all arrive as letters. Greetings, addressee and sender roles follow the reader." ^
 -m "Scenarios reuse the existing decision overlay and inbox routing, so a minutes conversation, a media request, a fitness call, dressing-room politics or a contract renewal carries the same weight as a manager's dilemma." ^
 -m "Tests: tools/test_v107_player_career_shell.cjs covers the selection model, save round-trip, the refused line-up edit against a permitted AI one, and mailbox authorship. tests/v107-player-career-shell.spec.cjs covers the shell, the read-only squad, the matchday verdict, the locked-down gestures, the mailbox and an untouched Manager Career. The V106 suites are retired in place, pointing at their replacements." ^
 -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" ^
 -m "Claude-Session: https://claude.ai/code/session_01DqjBex5zsEznbC124ohjiC"
if errorlevel 1 (echo. & echo ERROR: commit failed. & pause & exit /b 1)
echo.
echo ============================================================
echo  Committed on feature/v107-player-career-shell
echo ============================================================
git log -1 --stat --no-pager
echo.
echo Merge:   git checkout master ^&^& git merge feature/v107-player-career-shell
echo Push:    git push -u origin feature/v107-player-career-shell
echo Undo:    git checkout master ^&^& git branch -D feature/v107-player-career-shell
echo.
pause
