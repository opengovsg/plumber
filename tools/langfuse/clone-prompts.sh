#!/usr/bin/env bash

set -euo pipefail

# The prompts repo is the source of truth for prompt text. It stays private
# because plumber is public. See PROMPTS.md.
PROMPTS_REPO="${PLUMBER_PROMPTS_REPO:-https://github.com/opengovsg/plumber-prompts.git}"
PROMPTS_DIR="$(cd "$(dirname "$0")" && pwd -P)/prompts"

if [ ! -e "${PROMPTS_DIR}" ]; then
    git clone "${PROMPTS_REPO}" "${PROMPTS_DIR}"
    exit 0
fi

if ! git -C "${PROMPTS_DIR}" rev-parse --show-toplevel 2>/dev/null | grep -qxF "${PROMPTS_DIR}"; then
    echo "${PROMPTS_DIR} exists but is not a clone of the prompts repo." >&2
    echo "Move it aside, then run this again." >&2
    exit 1
fi

cd "${PROMPTS_DIR}"
git fetch origin
# A clone of an empty repo never learns origin's default branch.
if ! git symbolic-ref -q refs/remotes/origin/HEAD > /dev/null \
    && ! git remote set-head origin --auto > /dev/null 2>&1; then
    echo "Fetched. The prompts repo has no commits yet. See the initial sync in PROMPTS.md."
    exit 0
fi
DEFAULT_BRANCH=$(git symbolic-ref --short refs/remotes/origin/HEAD | sed 's|^origin/||')
CURRENT_BRANCH=$(git symbolic-ref --short -q HEAD || true)

# Only fast-forward when it cannot touch a developer's work in progress.
if [ "${CURRENT_BRANCH}" = "${DEFAULT_BRANCH}" ] && [ -z "$(git status --porcelain)" ]; then
    git merge --ff-only "origin/${DEFAULT_BRANCH}"
else
    echo "Fetched. You are on '${CURRENT_BRANCH:-a detached HEAD}' with your own changes, so nothing was merged."
fi
