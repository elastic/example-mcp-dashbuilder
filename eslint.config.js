/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import tseslint from 'typescript-eslint';
import { requireLicenseHeader } from './lint-license-rule.mjs';

export default tseslint.config({
  files: [
    'server/src/**/*.ts',
    'server/*.ts',
    'preview/src/**/*.ts',
    'preview/src/**/*.tsx',
    'preview/*.ts',
  ],
  ignores: ['**/grid-layout/**'],
  extends: [tseslint.configs.recommended],
  plugins: {
    'local-rules': {
      rules: {
        'require-license-header': requireLicenseHeader,
      },
    },
  },
  rules: {
    'local-rules/require-license-header': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      },
    ],
  },
});
