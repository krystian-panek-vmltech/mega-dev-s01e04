#!/usr/bin/env bash
# Plan morning-digest § 3: save one rig page as one self-contained HTML file (ADR 0001, 0003).
# Usage: scripts/save-preview.sh <path> <out.html>   e.g. /digest/2026-10-28 _site/index.html
# Reads .env like `pnpm start`. Never commit the output (ADR 0003).
set -euo pipefail
path="${1:?path}"; out="${2:?out file}"
port="${PREVIEW_PORT:-8799}"
PORT="$port" pnpm -s start >/dev/null 2>&1 &
pid=$!
trap 'kill $pid 2>/dev/null || true' EXIT
for _ in $(seq 1 50); do curl -fs "http://localhost:$port/health" >/dev/null && break; sleep 0.2; done
mkdir -p "$(dirname "$out")"
curl -fsS "http://localhost:$port$path" -o "$out"
echo "saved $path -> $out"
