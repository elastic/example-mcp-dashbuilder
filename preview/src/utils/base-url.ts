/** Base URL for API calls. Points to the Vite dev server when running inside the MCP App sandbox. */
export const BASE_URL =
  typeof window !== 'undefined' &&
  (window.location.protocol === 'https:' || window.location.hostname !== 'localhost')
    ? 'http://localhost:5173'
    : '';
