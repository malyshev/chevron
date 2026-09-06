#!/usr/bin/env bash
set -euo pipefail

last_tag="$(git describe --tags --abbrev=0 2>/dev/null || true)"
if [[ -z "${last_tag}" ]]; then
    exit 1
fi

git log "${last_tag}..HEAD" --format='- %s'
