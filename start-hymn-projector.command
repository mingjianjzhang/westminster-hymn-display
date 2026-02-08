#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$SCRIPT_DIR/start-hymn-projector.sh"

echo ""
echo "Hymn Projector stopped."
echo "Press Enter to close this window."
read -r
