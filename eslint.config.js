import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    files: ['server/src/**/*.ts', 'preview/src/**/*.ts', 'preview/src/**/*.tsx'],
    ignores: ['**/grid-layout/**'],
    extends: [tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      }],
    },
  },
);
