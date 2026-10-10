@echo off
rem MLF report library + notes local server (Windows entry)
where py >nul 2>nul && (py tools\notes-server.py) || (python tools\notes-server.py)
pause
