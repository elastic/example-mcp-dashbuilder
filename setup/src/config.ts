/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { resolve, dirname } from 'path';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = resolve(__dirname, '..', '..');
export const ENV_PATH = resolve(PROJECT_ROOT, '.env');
export const DEFAULT_ES_NODE = 'http://localhost:9200';
export const DEFAULT_KIBANA_URL = 'http://localhost:5601';

/**
 * Load existing .env values as a key-value map.
 */
export function loadExistingEnv(): Record<string, string> {
  const existing: Record<string, string> = {};
  if (existsSync(ENV_PATH)) {
    const content = readFileSync(ENV_PATH, 'utf-8');
    for (const line of content.split('\n')) {
      // Match env keys with letters, digits, and underscores (e.g., ES_V2_NODE),
      // then strip surrounding quotes from values to avoid double-quoting on write-back.
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (match) existing[match[1]] = match[2].replace(/^(["'])(.*?)\1$/, '$2');
    }
  }
  return existing;
}
