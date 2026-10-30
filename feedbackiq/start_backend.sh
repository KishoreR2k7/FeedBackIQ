#!/bin/bash
cd "$(dirname "$0")/backend" || exit 1
source .venv/bin/activate
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
