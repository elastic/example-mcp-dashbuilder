#!/usr/bin/env node
import { createInterface } from 'readline';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@elastic/elasticsearch';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, '..', '..', '.env');

const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(question: string, defaultValue?: string): Promise<string> {
  const prompt = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

interface ConnectionConfig {
  cloudId?: string;
  node?: string;
  apiKey?: string;
  username?: string;
  password?: string;
}

async function testConnection(config: ConnectionConfig): Promise<string> {
  const auth = config.apiKey
    ? { apiKey: config.apiKey }
    : config.username
      ? { username: config.username, password: config.password || '' }
      : undefined;

  const client = config.cloudId
    ? new Client({ cloud: { id: config.cloudId }, auth })
    : new Client({ node: config.node || 'http://localhost:9200', auth });

  const info = await client.info();
  return info.cluster_name;
}

async function main() {
  console.log('\n  elastic-dashbuilder setup\n');

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
    esNode = await ask('Elasticsearch URL', existing.ES_NODE || 'http://localhost:9200');
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
    existing.KIBANA_URL || (isCloud ? '' : 'http://localhost:5601')
  );

  // Test the connection
  process.stdout.write('\n  Testing connection... ');
  try {
    const clusterName = await testConnection({
      cloudId: cloudId || undefined,
      node: esNode || undefined,
      apiKey: apiKey || undefined,
      username: esUsername || undefined,
      password: esPassword || undefined,
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
  envLines.push('');

  writeFileSync(ENV_PATH, envLines.join('\n'));
  console.log(`  Saved to ${ENV_PATH}\n`);

  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
