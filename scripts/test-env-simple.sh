#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export AUTH_PROVIDER="simple"
export SIMPLE_AUTH_USER_FILE="${ROOT_DIR}/apps/api/tests/shared/simple-auth/users.yaml"
export VITE_AUTH_PROVIDER="simple"

echo "Simple auth environment configured:"
echo "  AUTH_PROVIDER=${AUTH_PROVIDER}"
echo "  SIMPLE_AUTH_USER_FILE=${SIMPLE_AUTH_USER_FILE}"
echo "  VITE_AUTH_PROVIDER=${VITE_AUTH_PROVIDER}"

if [[ "$#" -gt 0 ]]; then
  exec "$@"
fi
