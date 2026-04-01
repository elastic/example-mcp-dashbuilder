import { DEFAULT_KIBANA_URL } from './config.js';

export const KIBANA_URL = process.env.KIBANA_URL || DEFAULT_KIBANA_URL;

export function getKibanaAuthHeader(): string {
  const username = process.env.ES_USERNAME;
  const password = process.env.ES_PASSWORD;
  if (!username || !password) throw new Error('ES_USERNAME and ES_PASSWORD must be set');
  return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
}

/** Discover Kibana's base path by following the redirect from /api/status. */
export async function getKibanaBasePath(): Promise<string> {
  try {
    const res = await fetch(`${KIBANA_URL}/api/status`, {
      redirect: 'manual',
      headers: { Authorization: getKibanaAuthHeader() },
    });
    const location = res.headers.get('location');
    if (location && res.status >= 300 && res.status < 400) {
      const url = new URL(location, KIBANA_URL);
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
