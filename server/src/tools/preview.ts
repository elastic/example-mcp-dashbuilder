import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { exec } from 'child_process';
import { registerTool } from '../utils/register-tool.js';

const PREVIEW_URL = 'http://localhost:5173';

export function registerPreview(server: McpServer): void {
  registerTool(
    server,
    'preview',
    {
      title: 'Open Dashboard Preview',
      description:
        'Open the dashboard preview in the default browser. ' +
        'The preview app must be running (npm run dev:preview). ' +
        'Charts update automatically when added or modified.',
      inputSchema: {},
    },
    async () => {
      exec(`open ${PREVIEW_URL}`);
      return {
        content: [
          {
            type: 'text',
            text: `Opening dashboard preview at ${PREVIEW_URL}. Make sure the preview app is running with "npm run dev:preview".`,
          },
        ],
      };
    }
  );
}
