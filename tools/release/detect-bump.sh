#!/usr/bin/env bash
set -euo pipefail

# Prints skip | minor | patch. Logs go to stderr.
# Prefix feat|feature|fix on the associated PR branch wins; otherwise commit types since last tag.

head_subject="$(git log -1 --format=%s)"
if [[ "${head_subject}" =~ ^chore\(chevron\):\ release ]]; then
    echo skip
    exit 0
fi

last_tag="$(git describe --tags --abbrev=0 2>/dev/null || true)"
if [[ -z "${last_tag}" ]]; then
    echo "No release tag yet; bootstrap v1.0.0 manually." >&2
    echo skip
    exit 0
fi

branch="${RELEASE_HEAD_REF:-}"
if [[ -z "${branch}" && -n "${GITHUB_REPOSITORY:-}" && -n "${GITHUB_SHA:-}" ]]; then
    branch="$(gh api "repos/${GITHUB_REPOSITORY}/commits/${GITHUB_SHA}/pulls" --jq '.[0].head.ref // empty' 2>/dev/null || true)"
fi

if [[ "${branch}" =~ ^(feat|feature)/ ]]; then
    echo minor
    exit 0
fi

if [[ "${branch}" =~ ^fix/ ]]; then
    echo patch
    exit 0
fi

has_feat=0
has_fix=0
while IFS= read -r subject; do
    if [[ -z "${subject}" ]]; then
        continue
    fi
    if [[ "${subject}" =~ ^feat(!|\(|:|[[:space:]]) ]]; then
        has_feat=1
    elif [[ "${subject}" =~ ^fix(!|\(|:|[[:space:]]) ]]; then
        has_fix=1
    fi
done < <(git log "${last_tag}..HEAD" --format=%s)

if [[ "${has_feat}" -eq 1 ]]; then
    echo minor
    exit 0
fi

if [[ "${has_fix}" -eq 1 ]]; then
    echo patch
    exit 0
fi

echo skip
