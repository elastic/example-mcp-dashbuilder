/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { writeFileSync } from 'fs';

import { ENV_PATH } from './config.js';
import type { SetupConfig } from './types.js';

/**
 * Write the setup config to a .env file. Only includes non-empty values.
 */
export function writeEnvFile(config: SetupConfig): string {
  const lines: string[] = [];

  lines.push(`CONNECTION_TYPE=${config.connectionType}`);
  if (config.cloudId) lines.push(`ES_CLOUD_ID=${config.cloudId}`);
  if (config.esNode) lines.push(`ES_NODE=${config.esNode}`);
  if (config.apiKey) lines.push(`ES_API_KEY=${config.apiKey}`);
  if (config.username) lines.push(`ES_USERNAME=${config.username}`);
  if (config.password) lines.push(`ES_PASSWORD=${config.password}`);
  if (config.kibanaUrl) lines.push(`KIBANA_URL=${config.kibanaUrl}`);
  if (config.unsafeSsl) lines.push('UNSAFE_SSL=true');
  lines.push('');

  // Restrict file permissions to owner-only (read/write) since .env contains secrets
  writeFileSync(ENV_PATH, lines.join('\n'), { mode: 0o600 });
  return ENV_PATH;
}
