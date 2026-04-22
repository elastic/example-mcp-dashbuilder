#!/usr/bin/env node
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */
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

function maskValue(value: string): string {
  if (value.length <= 4) return '****';
  return '****' + value.slice(-4);
}

function ask(question: string, defaultValue?: string, sensitive?: boolean): Promise<string> {
  const displayDefault = defaultValue && sensitive ? maskValue(defaultValue) : defaultValue;
  const prompt = displayDefault ? `${question} [${displayDefault}]: ` : `${question}: `;
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

async function testConnection(
  config: ConnectionConfig & { serverless?: boolean }
): Promise<string> {
  const auth = config.apiKey
    ? { apiKey: config.apiKey }
    : config.username
      ? { username: config.username, password: config.password || '' }
      : undefined;

  const tls = config.unsafeSsl ? { rejectUnauthorized: false } : undefined;

  const client = config.cloudId
    ? new Client({ cloud: { id: config.cloudId }, auth, tls })
    : new Client({ node: config.node || DEFAULT_ES_NODE, auth, tls });

  if (config.serverless) {
    // Serverless API keys often lack cluster:monitor privileges needed by
    // client.info(). Use _has_privileges instead — every authenticated user
    // can call it on themselves with no extra grants.
    const res = await client.security.hasPrivileges({ cluster: ['monitor'] });
    return res.username;
  }

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
  const defaultConnectionType =
    existing.CONNECTION_TYPE || (existing.ES_CLOUD_ID ? 'cloud-hosted' : 'local');
  const connectionType = await ask(
    'Connection type (local / cloud-hosted / cloud-serverless)',
    defaultConnectionType
  );
  const connType = connectionType.toLowerCase();
  const isCloudHosted = connType === 'cloud-hosted';
  const isServerless = connType === 'cloud-serverless';

  let cloudId = '';
  let esNode = '';
  if (isCloudHosted) {
    cloudId = await ask('Cloud ID', existing.ES_CLOUD_ID || '', true);
  } else if (isServerless) {
    esNode = await ask('Elasticsearch URL', existing.ES_NODE || '');
  } else {
    esNode = await ask('Elasticsearch URL', existing.ES_NODE || DEFAULT_ES_NODE);
  }

  // Choose auth type (serverless always uses API keys)
  let apiKey = '';
  let esUsername = '';
  let esPassword = '';
  if (isServerless) {
    apiKey = await ask('API Key', existing.ES_API_KEY || '', true);
  } else {
    const authType = await ask(
      'Auth type (password / apikey)',
      existing.ES_API_KEY ? 'apikey' : 'password'
    );
    const useApiKey = authType.toLowerCase() === 'apikey';
    if (useApiKey) {
      apiKey = await ask('API Key', existing.ES_API_KEY || '', true);
    } else {
      esUsername = await ask('Username', existing.ES_USERNAME || 'elastic');
      esPassword = await ask('Password', existing.ES_PASSWORD || 'changeme', true);
    }
  }

  const kibanaUrl = await ask(
    'Kibana URL',
    existing.KIBANA_URL || (isCloudHosted || isServerless ? '' : DEFAULT_KIBANA_URL)
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
    const label = await testConnection({
      cloudId: cloudId || undefined,
      node: esNode || undefined,
      apiKey: apiKey || undefined,
      username: esUsername || undefined,
      password: esPassword || undefined,
      unsafeSsl,
      serverless: isServerless,
    });
    const detail = isServerless ? `user: ${label}` : `cluster: ${label}`;
    console.log(`Connected! (${detail})\n`);
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
  envLines.push(`CONNECTION_TYPE=${connType}`);
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
