#!/usr/bin/env bash
# Alias for start.sh (reload on save).
exec "$(dirname "${BASH_SOURCE[0]}")/start.sh" "$@"
