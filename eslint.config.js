// eslint.config.js - ESLint configuration for OpenProject MCP Server
import tsESLint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    ignores: [
      'dist/**',
      '.wrangler/**',
      'node_modules/**',
      '*.js',
      '*.d.ts',
      'src/tools/*Enterprise.ts',
      'src/tools/portfolioManagement.ts',
      'src/tools/riskManagement.ts',
      'src/tools/predictiveAnalytics.ts',
      'src/tools/programManagement.ts'
    ]
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json'
      }
    },
    plugins: {
      '@typescript-eslint': tsESLint
    },
    rules: {
      // Basic code quality rules
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-unused-vars': 'off', // Use TS version instead
      'prefer-const': 'error',
      'no-var': 'error',

      // TypeScript specific rules
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',

      // Code style rules (relaxed for private use)
      'eqeqeq': 'warn',
      'curly': 'warn',
      'brace-style': 'off',
      'comma-dangle': 'off',
      'quotes': 'off',
      'semi': 'warn',

      // Security rules
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',

      // Specific allowances for MCP server patterns
      '@typescript-eslint/no-explicit-any': 'off', // Common in MCP handlers
    }
  }
];