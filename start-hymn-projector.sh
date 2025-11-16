#!/usr/bin/env bash
set -euo pipefail

# Quick launcher for macOS/Linux users.
# - First run: installs dependencies with npm install
# - Subsequent runs: just starts the dev server

if [ ! -d "node_modules" ]; then
  echo "First-time setup: installing dependencies..."
  npm install
fi

echo "Starting Hymn Projector (dev server)..."
npm run dev
