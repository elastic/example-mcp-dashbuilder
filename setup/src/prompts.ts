/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import prompts from 'prompts';

import { DEFAULT_ES_NODE, DEFAULT_KIBANA_URL } from './config.js';
import type { ConnectionType, SetupConfig } from './types.js';

const MASK = '****';

/**
 * Prompt for a sensitive value (API key, Cloud ID, password).
 * Shows a masked placeholder when a saved value exists.
 * If the user presses Enter without typing, the real saved value is returned.
 */
async function askSensitive(message: string, savedValue: string | undefined): Promise<string> {
  const hasSaved = !!savedValue;
  const { value } = await prompts(
    {
      type: 'password',
      name: 'value',
      message: hasSaved ? `${message} [${MASK}]` : message,
    },
    { onCancel }
  );
  const trimmed = (value || '').trim();
  return trimmed || savedValue || '';
}

const onCancel = () => {
  console.log('');
  process.exit(1);
};

/** Prompt for connection type. */
async function promptConnectionType(defaultType: ConnectionType): Promise<ConnectionType> {
  const { connectionType } = await prompts(
    {
      type: 'select',
      name: 'connectionType',
      message: 'Connection type',
      choices: [
        { title: 'Local', value: 'local' },
        { title: 'Cloud (Hosted)', value: 'cloud-hosted' },
        { title: 'Cloud (Serverless)', value: 'cloud-serverless' },
      ],
      initial: ['local', 'cloud-hosted', 'cloud-serverless'].indexOf(defaultType),
    },
    { onCancel }
  );
  return connectionType;
}

/** Prompt for Elasticsearch endpoint (Cloud ID or URL). */
async function promptEndpoint(
  connectionType: ConnectionType,
  existing: Record<string, string>
): Promise<{ cloudId?: string; esNode?: string }> {
  if (connectionType === 'cloud-hosted') {
    const cloudId = await askSensitive('Cloud ID', existing.ES_CLOUD_ID);
    return { cloudId };
  }

  const defaultNode = connectionType === 'cloud-serverless' ? '' : DEFAULT_ES_NODE;
  const { esNode } = await prompts(
    {
      type: 'text',
      name: 'esNode',
      message: 'Elasticsearch URL',
      initial: existing.ES_NODE || defaultNode,
    },
    { onCancel }
  );
  return { esNode };
}

/** Prompt for authentication credentials. */
async function promptAuth(
  connectionType: ConnectionType,
  existing: Record<string, string>
): Promise<{ apiKey?: string; username?: string; password?: string }> {
  if (connectionType === 'cloud-serverless') {
    const apiKey = await askSensitive('API Key', existing.ES_API_KEY);
    return { apiKey };
  }

  const { authType } = await prompts(
    {
      type: 'select',
      name: 'authType',
      message: 'Auth type',
      choices: [
        { title: 'Username / Password', value: 'password' },
        { title: 'API Key', value: 'apikey' },
      ],
      initial: existing.ES_API_KEY ? 1 : 0,
    },
    { onCancel }
  );

  if (authType === 'apikey') {
    const apiKey = await askSensitive('API Key', existing.ES_API_KEY);
    return { apiKey };
  }

  const { username } = await prompts(
    {
      type: 'text',
      name: 'username',
      message: 'Username',
      initial: existing.ES_USERNAME || 'elastic',
    },
    { onCancel }
  );
  const savedPassword = existing.ES_PASSWORD;
  const password = savedPassword
    ? await askSensitive('Password', savedPassword)
    : (
        await prompts(
          // just for the case where .env is not present yet, we'll show "changeme" as the default instead of masking it
          { type: 'text', name: 'pw', message: 'Password', initial: 'changeme' },
          { onCancel }
        )
      ).pw || 'changeme';
  return { username, password };
}

/** Prompt for Kibana URL. */
async function promptKibanaUrl(
  connectionType: ConnectionType,
  existing: Record<string, string>
): Promise<string> {
  const isCloud = connectionType === 'cloud-hosted' || connectionType === 'cloud-serverless';
  const { kibanaUrl } = await prompts(
    {
      type: 'text',
      name: 'kibanaUrl',
      message: 'Kibana URL',
      initial: existing.KIBANA_URL || (isCloud ? '' : DEFAULT_KIBANA_URL),
    },
    { onCancel }
  );
  return kibanaUrl;
}

/** Prompt for self-signed certificate acceptance. */
async function promptUnsafeSsl(existing: Record<string, string>): Promise<boolean> {
  const { unsafeSsl } = await prompts(
    {
      type: 'confirm',
      name: 'unsafeSsl',
      message: 'Accept self-signed certificates?',
      initial: existing.UNSAFE_SSL === 'true',
    },
    { onCancel }
  );
  return unsafeSsl;
}

/** Prompt whether to save config despite connection failure. */
export async function promptSaveAnyway(): Promise<boolean> {
  const { proceed } = await prompts(
    {
      type: 'confirm',
      name: 'proceed',
      message: 'Save configuration anyway?',
      initial: false,
    },
    { onCancel }
  );
  return !!proceed;
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
