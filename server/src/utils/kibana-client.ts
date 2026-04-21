/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { Agent } from 'undici';

import { DEFAULT_KIBANA_URL } from './config.js';

/** Elastic API version header required by the Dashboard API (9.4+). */
export const DASHBOARD_API_VERSION = '2023-10-31';

const ERROR_BODY_MAX_LENGTH = 1000;

/** Read the response body for error reporting, truncating to avoid flooding MCP clients. */
export async function readErrorBody(response: Response): Promise<string> {
  const body = await response.text();
  if (body.length <= ERROR_BODY_MAX_LENGTH) return body;
  if (body.length > ERROR_BODY_MAX_LENGTH) {
    console.error(`[kibana-client] Full error body (${body.length} chars):`, body);
  }
  return body.slice(0, ERROR_BODY_MAX_LENGTH) + `… (truncated, ${body.length} chars total)`;
}

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

/**
 * Build the Authorization header for Kibana requests from env vars.
 * Both capability detection and actual API calls use this same function,
 * ensuring auth is consistent across all Kibana interactions.
 */
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

// ---------------------------------------------------------------------------
// Kibana capabilities detection
// ---------------------------------------------------------------------------

export interface KibanaCapabilities {
  /** Kibana version string, e.g. "9.4.0" */
  version: string;
  /** True for Elastic Cloud Serverless deployments */
  serverless: boolean;
  /** True when the new Dashboard API (/api/dashboards) is available (9.4+ or serverless) */
  hasDashboardApi: boolean;
}

const DASHBOARD_API_MIN_VERSION = [9, 4];

export function parseVersion(version: string): [number, number] {
  const parts = version.split('.');
  return [parseInt(parts[0], 10) || 0, parseInt(parts[1], 10) || 0];
}

export function meetsMinVersion(version: string): boolean {
  const [major, minor] = parseVersion(version);
  return (
    major > DASHBOARD_API_MIN_VERSION[0] ||
    (major === DASHBOARD_API_MIN_VERSION[0] && minor >= DASHBOARD_API_MIN_VERSION[1])
  );
}

/**
 * Build KibanaCapabilities from a /api/status response body.
 * Exported for testability.
 */
export function parseKibanaStatus(body: {
  version?: { number?: string; build_flavor?: string };
}): KibanaCapabilities {
  const version = body.version?.number ?? '0.0.0';
  const serverless = body.version?.build_flavor === 'serverless';
  const hasDashboardApi = serverless || meetsMinVersion(version);
  return { version, serverless, hasDashboardApi };
}

let capabilitiesPromise: Promise<KibanaCapabilities> | null = null;

/**
 * Detect Kibana version and capabilities by probing /api/status.
 * Uses the same getKibanaAuthHeader() as export/import tools, so auth is
 * consistent between detection and subsequent API calls.
 * Result is cached for the process lifetime. Call resetKibanaCapabilities() to clear.
 * The in-flight promise is cached
 * (not just the result) so concurrent callers share a single round-trip.
 */
export async function getKibanaCapabilities(): Promise<KibanaCapabilities> {
  if (capabilitiesPromise) return capabilitiesPromise;

  capabilitiesPromise = (async () => {
    const basePath = await getKibanaBasePath();
    const url = `${getKibanaUrl()}${basePath}/api/status`;

    try {
      const res = await kibanaFetch(url, {
        headers: { Authorization: getKibanaAuthHeader() },
      });

      if (!res.ok) {
        throw new Error(`/api/status returned ${res.status}`);
      }

      const body = (await res.json()) as {
        version?: { number?: string; build_flavor?: string };
      };

      return parseKibanaStatus(body);
    } catch {
      // Don't cache failures — allow retry next time
      resetKibanaCapabilities();
      return { version: '0.0.0', serverless: false, hasDashboardApi: false };
    }
  })();

  return capabilitiesPromise;
}

/** Clear the cached capabilities so the next call re-probes /api/status. */
export function resetKibanaCapabilities(): void {
  capabilitiesPromise = null;
}

/** Parse a dashboard ID from a URL or return the raw string. */
export function parseDashboardId(input: string): string {
  // Handle URLs like http://host:5601/app/dashboards#/view/UUID
  const urlMatch = input.match(/\/view\/([a-f0-9-]+)/i);
  if (urlMatch) return urlMatch[1];
  return input.trim();
}
