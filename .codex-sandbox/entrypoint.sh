#!/usr/bin/env zsh
set -e
set -u
set -o pipefail

# Route state into project-scoped sandbox directories
PROJECT_DIR="${PROJECT_DIR:-$PWD}"
SANDBOX_DIR="${PROJECT_DIR}/.codex-sandbox"

export HOME="${SANDBOX_DIR}/home"
mkdir -p "$HOME" /tmp

export CODEX_HOME="${CODEX_HOME:-${PROJECT_DIR}/.codex}"
mkdir -p "$CODEX_HOME"

export PNPM_STORE_PATH="${PROJECT_DIR}/.pnpm-store"
mkdir -p "$PNPM_STORE_PATH"

export XDG_CACHE_HOME="${SANDBOX_DIR}/cache"
mkdir -p "$XDG_CACHE_HOME"

export COREPACK_HOME="${SANDBOX_DIR}/cache/corepack"
mkdir -p "$COREPACK_HOME"

export XDG_CONFIG_HOME="${SANDBOX_DIR}/config"
export XDG_DATA_HOME="${SANDBOX_DIR}/data"
export XDG_STATE_HOME="${SANDBOX_DIR}/state"
mkdir -p "$XDG_CONFIG_HOME" "$XDG_DATA_HOME" "$XDG_STATE_HOME"

# Default to interactive Codex if no explicit command given
if [[ $# -eq 0 ]]; then
  # Pass through TTY interactivity for Codex; approvals live at /approvals
  exec codex
else
  exec "$@"
fi
