import { Client } from '@elastic/elasticsearch';

let client: Client | null = null;

export function getESClient(): Client {
  if (!client) {
    const node = process.env.ES_NODE || 'http://localhost:9200';
    const auth = process.env.ES_API_KEY
      ? { apiKey: process.env.ES_API_KEY }
      : process.env.ES_USERNAME
        ? { username: process.env.ES_USERNAME, password: process.env.ES_PASSWORD || '' }
        : undefined;

    client = new Client({ node, auth });
  }
  return client;
}
