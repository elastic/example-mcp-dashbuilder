import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

/** Project root directory. */
export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export const DEFAULT_ES_NODE = 'http://localhost:9200';
export const DEFAULT_KIBANA_URL = 'http://localhost:5601';

/** Path to the pre-built MCP App HTML (single-file bundle for Cursor's chat). */
export const MCP_APP_HTML_PATH = resolve(PROJECT_ROOT, 'preview', 'dist-mcp-app', 'index.html');
