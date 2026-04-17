/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { resolve, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

/** Project root directory. */
export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export const DEFAULT_ES_NODE = 'http://localhost:9200';
export const DEFAULT_KIBANA_URL = 'http://localhost:5601';

/**
 * Path to the pre-built MCP App HTML.
 * Checks the bundle location first (dist/bundle/mcp-app.html), then
 * falls back to the dev location (preview/dist-mcp-app/index.html).
 */
const BUNDLE_HTML_PATH = resolve(dirname(fileURLToPath(import.meta.url)), 'mcp-app.html');
const DEV_HTML_PATH = resolve(PROJECT_ROOT, 'preview', 'dist-mcp-app', 'index.html');
export const MCP_APP_HTML_PATH = existsSync(BUNDLE_HTML_PATH) ? BUNDLE_HTML_PATH : DEV_HTML_PATH;
