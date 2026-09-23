@echo off
cd /d "%~dp0"
set OUT=_v107-status.txt
echo === PUSH master -^> deploy/source === > "%OUT%"
echo. >> "%OUT%"
git push deploy HEAD:source >> "%OUT%" 2>&1
if errorlevel 1 (echo PUSH FAILED - see message above. >> "%OUT%" & goto end)
echo. >> "%OUT%"
echo --- local master --- >> "%OUT%"
git --no-pager log --oneline -1 master >> "%OUT%" 2>&1
echo --- remote source --- >> "%OUT%"
git --no-pager log --oneline -1 deploy/source >> "%OUT%" 2>&1
echo. >> "%OUT%"
echo --- ahead/behind, should be 0 0 --- >> "%OUT%"
git rev-list --left-right --count master...deploy/source >> "%OUT%" 2>&1
:end
echo. >> "%OUT%"
echo DONE >> "%OUT%"
