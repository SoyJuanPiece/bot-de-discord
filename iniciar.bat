@echo off
title TitanBot
echo Iniciando TitanBot...

for /f "tokens=2 delims==" %%a in ('wmic os get localdatetime /value') do set datetime=%%a
set fecha=%datetime:~0,8%_%datetime:~8,6%

echo Logs se guardan en: logs\%fecha%.log
echo.

if not exist logs mkdir logs
node src/index.js > logs\%fecha%.log 2>&1
pause
