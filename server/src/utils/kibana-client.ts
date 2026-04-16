/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { Agent } from 'undici';

import { DEFAULT_KIBANA_URL } from './config.js';

/** Read lazily so .env has time to load (ESM imports run before top-level code in index.ts). */
export function getKibanaUrl(): string {
  return process.env.KIBANA_URL || DEFAULT_KIBANA_URL;
}

const unsafeSslAgent = new Agent({ connect: { rejectUnauthorized: false } });

/** fetch() wrapper that honours the UNSAFE_SSL env var for self-signed certs. */
export function kibanaFetch(url: string, init?: RequestInit): Promise<Response> {
  if (process.env.UNSAFE_SSL === 'true') {
    return fetch(url, { ...init, dispatcher: unsafeSslAgent } as RequestInit);
  }
  return fetch(url, init);
}

export function getKibanaAuthHeader(): string {
  const apiKey = process.env.ES_API_KEY;
  if (apiKey) {
    return `ApiKey ${apiKey}`;
  }
  const username = process.env.ES_USERNAME;
  const password = process.env.ES_PASSWORD;
  if (username && password) {
    return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
  }
  throw new Error('Either ES_API_KEY or ES_USERNAME/ES_PASSWORD must be set');
}

/** Discover Kibana's base path by following the redirect from /api/status. */
export async function getKibanaBasePath(): Promise<string> {
  try {
    const res = await kibanaFetch(`${getKibanaUrl()}/api/status`, {
      redirect: 'manual',
      headers: { Authorization: getKibanaAuthHeader() },
    });
    const location = res.headers.get('location');
    if (location && res.status >= 300 && res.status < 400) {
      const url = new URL(location, getKibanaUrl());
      return url.pathname.replace(/\/status$/, '');
    }
  } catch {
    // Fall through
  }
  return '';
}

/** Parse a dashboard ID from a URL or return the raw string. */
export function parseDashboardId(input: string): string {
  // Handle URLs like http://host:5601/app/dashboards#/view/UUID
  const urlMatch = input.match(/\/view\/([a-f0-9-]+)/i);
  if (urlMatch) return urlMatch[1];
  return input.trim();
}
