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
