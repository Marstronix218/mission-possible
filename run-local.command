#!/bin/zsh
set -eu
cd "$(dirname "$0")"
# Prefer system Node; this workspace also contains an isolated Node runtime.
if ! command -v node >/dev/null 2>&1; then
  runtime="$PWD/../../work/node-v22.23.5-darwin-arm64/bin"
  if [[ -x "$runtime/node" ]]; then
    export PATH="$runtime:$PATH"
  else
    echo 'Install Node.js 22.13 or newer, then run this launcher again.'
    exit 1
  fi
fi
if [[ ! -d node_modules ]]; then npm ci; fi
npm run dev
