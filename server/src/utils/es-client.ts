/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { Client } from '@elastic/elasticsearch';
import { DEFAULT_ES_NODE } from './config.js';

let client: Client | null = null;

export function getESClient(): Client {
  if (!client) {
    const cloudId = process.env.ES_CLOUD_ID;
    const node = process.env.ES_NODE || DEFAULT_ES_NODE;
    const auth = process.env.ES_API_KEY
      ? { apiKey: process.env.ES_API_KEY }
      : process.env.ES_USERNAME
        ? { username: process.env.ES_USERNAME, password: process.env.ES_PASSWORD || '' }
        : undefined;
    const tls = process.env.UNSAFE_SSL === 'true' ? { rejectUnauthorized: false } : undefined;

    client = cloudId
      ? new Client({ cloud: { id: cloudId }, auth, tls })
      : new Client({ node, auth, tls });
  }
  return client;
}
