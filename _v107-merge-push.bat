@echo off
cd /d "%~dp0"
set OUT=_v107-status.txt
echo === MERGE AND PUSH === > "%OUT%"
echo. >> "%OUT%"
echo --- remotes --- >> "%OUT%"
git remote -v >> "%OUT%" 2>&1
git remote | findstr /r "." >nul
if errorlevel 1 (
  echo. >> "%OUT%"
  echo NO REMOTE CONFIGURED - merging locally only, nothing to push. >> "%OUT%"
  set NOREMOTE=1
)
echo. >> "%OUT%"
echo --- checkout master --- >> "%OUT%"
git checkout master >> "%OUT%" 2>&1
if errorlevel 1 (echo CHECKOUT FAILED - stopping. >> "%OUT%" & goto end)
echo. >> "%OUT%"
echo --- merge --- >> "%OUT%"
git merge --ff-only feature/v107-player-career-shell >> "%OUT%" 2>&1
if errorlevel 1 (echo FAST-FORWARD MERGE FAILED - master has diverged, nothing changed. >> "%OUT%" & goto end)
echo. >> "%OUT%"
echo --- master now --- >> "%OUT%"
git --no-pager log --oneline -3 >> "%OUT%" 2>&1
if defined NOREMOTE goto end
echo. >> "%OUT%"
echo --- push --- >> "%OUT%"
git push origin master >> "%OUT%" 2>&1
if errorlevel 1 (echo PUSH FAILED - see message above. >> "%OUT%" & goto end)
echo. >> "%OUT%"
echo --- remote tracking --- >> "%OUT%"
git --no-pager log --oneline -1 origin/master >> "%OUT%" 2>&1
:end
echo. >> "%OUT%"
echo DONE >> "%OUT%"
