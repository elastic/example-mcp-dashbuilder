/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Builds the preview app as a single self-contained HTML file
 * for embedding as an MCP App inside Cursor's chat.
 * All JS, CSS, and assets are inlined into one HTML file.
 */
export default defineConfig({
  plugins: [
    react({
      jsxImportSource: '@emotion/react',
    }),
    viteSingleFile(),
  ],
  build: {
    outDir: 'dist-mcp-app',
    emptyOutDir: true,
  },
});
