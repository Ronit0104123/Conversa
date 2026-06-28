#!/bin/bash
# Start the Conversa backend
# Usage:
#   ./start.sh          → production mode (uses $PORT, no reload)
#   ./start.sh dev      → local dev mode (port 8000, auto-reload)

set -e

cd "$(dirname "$0")"

if [ "$1" = "dev" ]; then
  echo "Starting in dev mode (port 8000, --reload)..."
  source venv/bin/activate
  uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
else
  echo "Starting in production mode (port ${PORT:-8000})..."
  uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
fi
