#!/usr/bin/env bash
# Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
# or more contributor license agreements. Licensed under the Elastic License 2.0;
# you may not use this file except in compliance with the Elastic License 2.0.

# MCP server launcher — resolves nvm/node paths automatically.
# Use this in your MCP client config instead of calling npx directly.

DIR="$(cd "$(dirname "$0")" && pwd)"

# Load nvm if available (fixes PATH when Cursor/Claude Desktop isn't launched from terminal)
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh"
fi

cd "$DIR"
exec npx tsx server/src/index.ts
