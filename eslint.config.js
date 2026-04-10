import tseslint from 'typescript-eslint';
import { requireLicenseHeader } from './lint-license-rule.mjs';

export default tseslint.config({
  files: ['server/src/**/*.ts', 'preview/src/**/*.ts', 'preview/src/**/*.tsx'],
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
