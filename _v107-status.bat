@echo off
cd /d "%~dp0"
set OUT=_v107-status.txt
echo === BRANCH === > "%OUT%"
git rev-parse --abbrev-ref HEAD >> "%OUT%" 2>&1
echo. >> "%OUT%"
echo === LAST 6 COMMITS === >> "%OUT%"
git --no-pager log --oneline -6 >> "%OUT%" 2>&1
echo. >> "%OUT%"
echo === HEAD FILES === >> "%OUT%"
git --no-pager show --stat --oneline HEAD >> "%OUT%" 2>&1
echo. >> "%OUT%"
echo === WORKING TREE STATUS === >> "%OUT%"
git status --porcelain >> "%OUT%" 2>&1
echo. >> "%OUT%"
echo === V107 FILES VS HEAD === >> "%OUT%"
git --no-pager diff --stat HEAD -- index.html velmora-quidditch-engine.js player-career.css release-meta.js career-bootstrap.js tools/test_v106_player_career.cjs tests/v106-player-career.spec.cjs >> "%OUT%" 2>&1
echo. >> "%OUT%"
echo === MASTER VS BRANCH === >> "%OUT%"
git --no-pager log --oneline master -3 >> "%OUT%" 2>&1
echo Done. Wrote %OUT%
