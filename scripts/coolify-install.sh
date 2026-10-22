#!/usr/bin/env bash
# Coolify's Nixpacks image ships npm 10.9.0. That release crashes on this
# package tree with "Cannot read properties of null (reading 'edgesOut')".
# The one-package install below succeeds; the project install must use npm 11.
set -euo pipefail

cd /app

unset NPM_CONFIG_PRODUCTION npm_config_production NPM_CONFIG_OMIT npm_config_omit || true
export NODE_ENV=development

npm install --prefix /tmp/npm-cli npm@11 --cache /tmp/npm-cache-cli --no-audit --no-fund

NPM_CLI="$(find /tmp/npm-cli -name npm-cli.js -print -quit)"
if [[ -z "$NPM_CLI" ]]; then
  echo "npm 11 did not install a cli at /tmp/npm-cli" >&2
  exit 1
fi

node "$NPM_CLI" install --include=dev --legacy-peer-deps --cache /tmp/npm-cache --no-audit --no-fund
