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

async function testConnection(node: string, username: string, password: string): Promise<string> {
  const client = new Client({
    node,
    auth: username ? { username, password } : undefined,
  });
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

  const esNode = await ask('Elasticsearch URL', existing.ES_NODE || 'http://localhost:9200');
  const esUsername = await ask('Username', existing.ES_USERNAME || 'elastic');
  const esPassword = await ask('Password', existing.ES_PASSWORD || 'changeme');
  const kibanaUrl = await ask('Kibana URL', existing.KIBANA_URL || 'http://localhost:5601');

  // Test the connection
  process.stdout.write('\n  Testing connection... ');
  try {
    const clusterName = await testConnection(esNode, esUsername, esPassword);
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

  // Write .env
  const envContent = [
    `ES_NODE=${esNode}`,
    `ES_USERNAME=${esUsername}`,
    `ES_PASSWORD=${esPassword}`,
    `KIBANA_URL=${kibanaUrl}`,
    '',
  ].join('\n');

  writeFileSync(ENV_PATH, envContent);
  console.log(`  Saved to ${ENV_PATH}\n`);

  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
