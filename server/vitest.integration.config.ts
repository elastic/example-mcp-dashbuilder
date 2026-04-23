/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'mcp-integration',
    globals: true,
    environment: 'node',
    include: ['src/integration-tests/suites/**/*.test.ts'],
    globalSetup: ['src/integration-tests/setup/global.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000, // ES + Kibana container startup
    sequence: { concurrent: false },
    reporters: ['verbose'],
  },
});
