#!/usr/bin/env bash
# Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
# or more contributor license agreements. Licensed under the Elastic License 2.0;
# you may not use this file except in compliance with the Elastic License 2.0.

# Build a self-contained bundle for distribution (.mcpb / npm tarball).
# The bundle includes the server JS + all runtime assets (MCP App HTML, ES|QL docs).

set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUNDLE_DIR="$DIR/dist/bundle"

echo "Building server..."
npm run build --workspace=server

echo "Building preview app..."
npm run build --workspace=preview

echo "Bundling with esbuild..."
rm -rf "$BUNDLE_DIR"
mkdir -p "$BUNDLE_DIR"

npx esbuild "$DIR/server/dist/index.js" \
  --bundle \
  --platform=node \
  --format=esm \
  --target=node22 \
  --outfile="$BUNDLE_DIR/server.mjs" \
  --external:puppeteer \
  --banner:js="import{createRequire}from'module';const require=createRequire(import.meta.url);"

echo "Copying runtime assets..."
# MCP App HTML (single-file bundle for inline previews)
cp "$DIR/preview/dist-mcp-app/index.html" "$BUNDLE_DIR/mcp-app.html"

# ES|QL reference docs
mkdir -p "$BUNDLE_DIR/esql_docs"
cp "$DIR/server/src/resources/esql_docs/"*.txt "$BUNDLE_DIR/esql_docs/"

echo "Bundle created at $BUNDLE_DIR"
ls -lh "$BUNDLE_DIR/server.mjs"
