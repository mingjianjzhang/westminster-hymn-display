#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed."
  echo "Please install the LTS version from https://nodejs.org/en"
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies (first run)..."
  npm install
fi

echo "Starting Hymn Projector..."
npm run dev
