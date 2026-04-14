/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { readFileSync } from 'fs';
import { MCP_APP_HTML_PATH } from './config.js';

export function loadMcpAppHtml(): string {
  try {
    return readFileSync(MCP_APP_HTML_PATH, 'utf-8');
  } catch {
    return `<!DOCTYPE html>
<html><body>
<p>MCP App not built. Run <code>npm run build --workspace=preview</code> first.</p>
</body></html>`;
  }
}
