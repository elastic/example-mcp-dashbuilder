#!/usr/bin/env node
import { createInterface } from 'readline';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { Client } from '@elastic/elasticsearch';
import { DEFAULT_ES_NODE, DEFAULT_KIBANA_URL, PROJECT_ROOT } from './utils/config.js';

const ENV_PATH = resolve(PROJECT_ROOT, '.env');

const rl = createInterface({ input: process.stdin, output: process.stdout });

interface ConnectionConfig {
  cloudId?: string;
  node?: string;
  apiKey?: string;
  username?: string;
  password?: string;
  unsafeSsl?: boolean;
}

function ask(question: string, defaultValue?: string): Promise<string> {
  const prompt = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

async function testConnection(config: ConnectionConfig): Promise<string> {
  const auth = config.apiKey
    ? { apiKey: config.apiKey }
    : config.username
      ? { username: config.username, password: config.password || '' }
      : undefined;

  const tls = config.unsafeSsl ? { rejectUnauthorized: false } : undefined;

  const client = config.cloudId
    ? new Client({ cloud: { id: config.cloudId }, auth, tls })
    : new Client({ node: config.node || DEFAULT_ES_NODE, auth, tls });

  const info = await client.info();
  return info.cluster_name;
}

async function main() {
  console.log('\n  example-mcp-dashbuilder setup\n');

  // Load existing .env values as defaults
  const existing: Record<string, string> = {};
  if (existsSync(ENV_PATH)) {
    const content = readFileSync(ENV_PATH, 'utf-8');
    for (const line of content.split('\n')) {
      const match = line.match(/^([A-Z_]+)=(.*)$/);
      if (match) existing[match[1]] = match[2];
    }
  }

  // Choose connection type
  const connectionType = await ask(
    'Connection type (local / cloud)',
    existing.ES_CLOUD_ID ? 'cloud' : 'local'
  );
  const isCloud = connectionType.toLowerCase() === 'cloud';

  let cloudId = '';
  let esNode = '';
  if (isCloud) {
    cloudId = await ask('Cloud ID', existing.ES_CLOUD_ID || '');
  } else {
    esNode = await ask('Elasticsearch URL', existing.ES_NODE || DEFAULT_ES_NODE);
  }

  // Choose auth type
  const authType = await ask(
    'Auth type (password / apikey)',
    existing.ES_API_KEY ? 'apikey' : 'password'
  );
  const useApiKey = authType.toLowerCase() === 'apikey';

  let apiKey = '';
  let esUsername = '';
  let esPassword = '';
  if (useApiKey) {
    apiKey = await ask('API Key', existing.ES_API_KEY || '');
  } else {
    esUsername = await ask('Username', existing.ES_USERNAME || 'elastic');
    esPassword = await ask('Password', existing.ES_PASSWORD || 'changeme');
  }

  const kibanaUrl = await ask(
    'Kibana URL',
    existing.KIBANA_URL || (isCloud ? '' : DEFAULT_KIBANA_URL)
  );

  // Ask about self-signed certificates when using HTTPS with localhost
  let unsafeSsl = false;
  const isLocalHttps =
    /^https:\/\/(localhost|127\.0\.0\.1)/i.test(esNode) ||
    /^https:\/\/(localhost|127\.0\.0\.1)/i.test(kibanaUrl);
  if (isLocalHttps) {
    const sslAnswer = await ask(
      'Accept self-signed certificates? (y/n)',
      existing.UNSAFE_SSL === 'true' ? 'y' : 'n'
    );
    unsafeSsl = sslAnswer.toLowerCase() === 'y';
  }

  // Test the connection
  process.stdout.write('\n  Testing connection... ');
  try {
    const clusterName = await testConnection({
      cloudId: cloudId || undefined,
      node: esNode || undefined,
      apiKey: apiKey || undefined,
      username: esUsername || undefined,
      password: esPassword || undefined,
      unsafeSsl,
    });
    console.log(`Connected! (cluster: ${clusterName})\n`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`Failed!\n\n  Error: ${message}\n`);
    const proceed = await ask('Save anyway? (y/n)', 'n');
    if (proceed.toLowerCase() !== 'y') {
      rl.close();
      process.exit(1);
    }
    console.log();
  }

  // Write .env — only include non-empty values
  const envLines: string[] = [];
  if (cloudId) envLines.push(`ES_CLOUD_ID=${cloudId}`);
  if (esNode) envLines.push(`ES_NODE=${esNode}`);
  if (apiKey) envLines.push(`ES_API_KEY=${apiKey}`);
  if (esUsername) envLines.push(`ES_USERNAME=${esUsername}`);
  if (esPassword) envLines.push(`ES_PASSWORD=${esPassword}`);
  if (kibanaUrl) envLines.push(`KIBANA_URL=${kibanaUrl}`);
  if (unsafeSsl) envLines.push('UNSAFE_SSL=true');
  envLines.push('');

  writeFileSync(ENV_PATH, envLines.join('\n'));
  console.log(`  Saved to ${ENV_PATH}\n`);

  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
