/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import prompts from 'prompts';

import { DEFAULT_ES_NODE, DEFAULT_KIBANA_URL } from './config.js';
import type { ConnectionType, SetupConfig } from './types.js';

/** Prompt for connection type. */
async function promptConnectionType(defaultType: ConnectionType): Promise<ConnectionType> {
  const { connectionType } = await prompts({
    type: 'select',
    name: 'connectionType',
    message: 'Connection type',
    choices: [
      { title: 'Local', value: 'local' },
      { title: 'Cloud (Hosted)', value: 'cloud-hosted' },
      { title: 'Cloud (Serverless)', value: 'cloud-serverless' },
    ],
    initial: ['local', 'cloud-hosted', 'cloud-serverless'].indexOf(defaultType),
  });
  return connectionType;
}

/** Prompt for Elasticsearch endpoint (Cloud ID or URL). */
async function promptEndpoint(
  connectionType: ConnectionType,
  existing: Record<string, string>
): Promise<{ cloudId?: string; esNode?: string }> {
  if (connectionType === 'cloud-hosted') {
    const { cloudId } = await prompts({
      type: 'text',
      name: 'cloudId',
      message: 'Cloud ID',
      initial: existing.ES_CLOUD_ID || '',
    });
    return { cloudId };
  }

  const defaultNode = connectionType === 'cloud-serverless' ? '' : DEFAULT_ES_NODE;
  const { esNode } = await prompts({
    type: 'text',
    name: 'esNode',
    message: 'Elasticsearch URL',
    initial: existing.ES_NODE || defaultNode,
  });
  return { esNode };
}

/** Prompt for authentication credentials. */
async function promptAuth(
  connectionType: ConnectionType,
  existing: Record<string, string>
): Promise<{ apiKey?: string; username?: string; password?: string }> {
  if (connectionType === 'cloud-serverless') {
    const { apiKey } = await prompts({
      type: 'password',
      name: 'apiKey',
      message: 'API Key',
      initial: existing.ES_API_KEY || '',
    });
    return { apiKey };
  }

  const { authType } = await prompts({
    type: 'select',
    name: 'authType',
    message: 'Auth type',
    choices: [
      { title: 'Username / Password', value: 'password' },
      { title: 'API Key', value: 'apikey' },
    ],
    initial: existing.ES_API_KEY ? 1 : 0,
  });

  if (authType === 'apikey') {
    const { apiKey } = await prompts({
      type: 'password',
      name: 'apiKey',
      message: 'API Key',
      initial: existing.ES_API_KEY || '',
    });
    return { apiKey };
  }

  const { username } = await prompts({
    type: 'text',
    name: 'username',
    message: 'Username',
    initial: existing.ES_USERNAME || 'elastic',
  });
  const { password } = await prompts({
    type: 'password',
    name: 'password',
    message: 'Password',
    initial: existing.ES_PASSWORD || 'changeme',
  });
  return { username, password };
}

/** Prompt for Kibana URL. */
async function promptKibanaUrl(
  connectionType: ConnectionType,
  existing: Record<string, string>
): Promise<string> {
  const isCloud = connectionType === 'cloud-hosted' || connectionType === 'cloud-serverless';
  const { kibanaUrl } = await prompts({
    type: 'text',
    name: 'kibanaUrl',
    message: 'Kibana URL',
    initial: existing.KIBANA_URL || (isCloud ? '' : DEFAULT_KIBANA_URL),
  });
  return kibanaUrl;
}

/** Prompt for self-signed certificate acceptance. */
async function promptUnsafeSsl(existing: Record<string, string>): Promise<boolean> {
  const { unsafeSsl } = await prompts({
    type: 'confirm',
    name: 'unsafeSsl',
    message: 'Accept self-signed certificates?',
    initial: existing.UNSAFE_SSL === 'true',
  });
  return unsafeSsl;
}

/**
 * Run all setup prompts and return the full configuration.
 */
export async function promptForOptions(existing: Record<string, string>): Promise<SetupConfig> {
  const defaultType: ConnectionType =
    (existing.CONNECTION_TYPE as ConnectionType) ||
    (existing.ES_CLOUD_ID ? 'cloud-hosted' : 'local');

  const connectionType = await promptConnectionType(defaultType);
  const endpoint = await promptEndpoint(connectionType, existing);
  const auth = await promptAuth(connectionType, existing);
  const kibanaUrl = await promptKibanaUrl(connectionType, existing);

  // Ask about self-signed certs when using HTTPS with localhost
  const esUrl = endpoint.esNode || '';
  const isLocalHttps =
    /^https:\/\/(localhost|127\.0\.0\.1)/i.test(esUrl) ||
    /^https:\/\/(localhost|127\.0\.0\.1)/i.test(kibanaUrl);
  const unsafeSsl = isLocalHttps ? await promptUnsafeSsl(existing) : false;

  return {
    connectionType,
    cloudId: endpoint.cloudId,
    esNode: endpoint.esNode,
    apiKey: auth.apiKey,
    username: auth.username,
    password: auth.password,
    kibanaUrl,
    unsafeSsl,
  };
}
