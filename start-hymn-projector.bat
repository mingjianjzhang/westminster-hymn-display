@echo off
setlocal

REM Quick launcher for Windows users.
REM - First run: installs dependencies with npm install
REM - Subsequent runs: just starts the dev server

if not exist node_modules (
  echo First-time setup: installing dependencies...
  npm install
  if errorlevel 1 (
    echo npm install failed. Please check that Node.js is installed and try again.
    pause
    exit /b 1
  )
)

echo Starting Hymn Projector (dev server)...
npm run dev
pause
