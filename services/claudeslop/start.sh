#!/usr/bin/env bash
# Run the two processes that make up the labeler in one container: the Python
# detector sidecar (torch + desklib) and the Node labeler. They talk over
# localhost (DETECTOR_URL). If either exits, tear the whole container down so
# the platform restarts it cleanly — we never want one running without the
# other.
set -euo pipefail

DETECTOR_PORT="${DETECTOR_PORT:-8000}"

# Python detector (background). The venv is baked into the image at /opt/pyenv.
/opt/pyenv/bin/uvicorn app:app \
  --app-dir services/claudeslop/detector \
  --host 127.0.0.1 --port "${DETECTOR_PORT}" &
detector_pid=$!

# Node labeler (background). It polls the detector's /health before scoring.
DETECTOR_URL="http://127.0.0.1:${DETECTOR_PORT}" \
  node --import tsx services/claudeslop/src/index.ts &
labeler_pid=$!

# Exit as soon as either process does; kill the survivor on the way out.
wait -n
trap - EXIT
kill "${detector_pid}" "${labeler_pid}" 2>/dev/null || true
exit 1
