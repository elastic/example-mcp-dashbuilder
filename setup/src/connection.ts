/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { Client } from '@elastic/elasticsearch';

import type { SetupConfig } from './types.js';

/**
 * Test the Elasticsearch connection and return a descriptive label.
 */
export async function testConnection(config: SetupConfig): Promise<string> {
  const auth = config.apiKey
    ? { apiKey: config.apiKey }
    : config.username
      ? { username: config.username, password: config.password || '' }
      : undefined;

  const tls = config.unsafeSsl ? { rejectUnauthorized: false } : undefined;

  const client = config.cloudId
    ? new Client({ cloud: { id: config.cloudId }, auth, tls })
    : new Client({ node: config.esNode || 'http://localhost:9200', auth, tls });

  if (config.connectionType === 'cloud-serverless') {
    const res = await client.security.hasPrivileges({ cluster: ['monitor'] });
    return `user: ${res.username}`;
  }

  const info = await client.info();
  return `cluster: ${info.cluster_name}`;
}
