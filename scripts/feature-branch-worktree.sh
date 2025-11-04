#!/bin/bash

set -euo pipefail
set -x

usage() {
  echo "Usage: $0 <branch-name>" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

BRANCH_NAME="${1:-}"
[ -n "${BRANCH_NAME}" ] || usage

TARGET_DIR="${REPO_ROOT}/worktrees/${BRANCH_NAME}"

if ! git -C "${REPO_ROOT}" show-ref --verify --quiet "refs/heads/${BRANCH_NAME}"; then
  echo "Branch '${BRANCH_NAME}' does not exist locally. Fetch or create it first." >&2
  exit 1
fi

if [ -e "${TARGET_DIR}" ]; then
  echo "Target directory '${TARGET_DIR}' already exists." >&2
  exit 1
fi

if git -C "${REPO_ROOT}" worktree list --porcelain | awk '/^branch / {print $2}' | grep -Fxq "refs/heads/${BRANCH_NAME}"; then
  echo "Branch '${BRANCH_NAME}' already has a worktree." >&2
  exit 1
fi

mkdir -p "$(dirname "${TARGET_DIR}")"
git -C "${REPO_ROOT}" worktree add "${TARGET_DIR}" "${BRANCH_NAME}"

LOCAL_COPY_PATHS=(
  ".codex/config.toml"
  ".codex/auth.json"
  "apps/api/.env.local"
  "apps/web/.env.local"
  "apps/api/local"
  "apps/api/data"
)

for relative_path in "${LOCAL_COPY_PATHS[@]}"; do
  source_path="${REPO_ROOT}/${relative_path}"
  target_path="${TARGET_DIR}/${relative_path}"

  if [ ! -e "${source_path}" ]; then
    continue
  fi

  if [ -d "${source_path}" ]; then
    mkdir -p "${target_path}"
    rsync -a --ignore-existing "${source_path}/" "${target_path}/"
    continue
  fi

  if [ -e "${target_path}" ]; then
    echo "Skipping copy for '${relative_path}' because it already exists in the worktree." >&2
    continue
  fi

  mkdir -p "$(dirname "${target_path}")"

  cp -a "${source_path}" "${target_path}"
done
