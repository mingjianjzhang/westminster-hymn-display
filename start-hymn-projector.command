#!/usr/bin/env bash

# Double-click starter for macOS.
# First run: installs dependencies if missing, then starts dev server.
# Subsequent runs: just starts the dev server.

set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
  echo "First-time setup: installing dependencies..."
  npm install
fi

echo "Starting Hymn Projector (dev server)..."
npm run dev

read -p "Press Enter to close this window..."
