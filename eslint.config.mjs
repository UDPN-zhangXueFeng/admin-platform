import nx from '@nx/eslint-plugin';
import tseslint from 'typescript-eslint';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/out-tsc',
      '**/test-output',
      '**/.next',
      '**/.next-stub',
      '**/tmp',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            // === Scope-level constraints ===

            // Admin app: shell app that integrates shared + modules features
            {
              sourceTag: 'scope:admin',
              onlyDependOnLibsWithTags: ['scope:admin', 'scope:shared', 'scope:modules'],
            },

            // Module scopes: each module can only depend on itself + shared
            {
              sourceTag: 'scope:user',
              onlyDependOnLibsWithTags: ['scope:user', 'scope:shared'],
            },
            {
              sourceTag: 'scope:order',
              onlyDependOnLibsWithTags: ['scope:order', 'scope:shared'],
            },
            {
              sourceTag: 'scope:inventory',
              onlyDependOnLibsWithTags: ['scope:inventory', 'scope:shared'],
            },
            {
              sourceTag: 'scope:report',
              onlyDependOnLibsWithTags: ['scope:report', 'scope:shared'],
            },
            {
              sourceTag: 'scope:setting',
              onlyDependOnLibsWithTags: ['scope:setting', 'scope:shared'],
            },
            {
              sourceTag: 'scope:notification',
              onlyDependOnLibsWithTags: ['scope:notification', 'scope:shared'],
            },
            {
              sourceTag: 'scope:product',
              onlyDependOnLibsWithTags: ['scope:product', 'scope:shared'],
            },
            {
              sourceTag: 'scope:modules',
              onlyDependOnLibsWithTags: ['scope:modules', 'scope:shared'],
            },
            {
              sourceTag: 'scope:travel-rule',
              onlyDependOnLibsWithTags: ['scope:travel-rule', 'scope:shared'],
            },

            // Shared scope: only depends on shared
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },

            // === Type-level constraints ===

            // Feature: can depend on feature, ui, data-access, util, model, app
            {
              sourceTag: 'type:feature',
              onlyDependOnLibsWithTags: ['type:feature', 'type:ui', 'type:data-access', 'type:util', 'type:model', 'type:app'],
            },

            // UI: can depend on ui, util, model
            {
              sourceTag: 'type:ui',
              onlyDependOnLibsWithTags: ['type:ui', 'type:util', 'type:model'],
            },

            // Data-access: can depend on data-access, util, model
            {
              sourceTag: 'type:data-access',
              onlyDependOnLibsWithTags: ['type:data-access', 'type:util', 'type:model'],
            },

            // Util: can depend on util, model
            {
              sourceTag: 'type:util',
              onlyDependOnLibsWithTags: ['type:util', 'type:model'],
            },

            // Model: only depends on model
            {
              sourceTag: 'type:model',
              onlyDependOnLibsWithTags: ['type:model'],
            },

            // App: can depend on everything
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: ['*'],
            },

            // E2E: can depend on everything (tests)
            {
              sourceTag: 'type:e2e',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    rules: {},
  },
];
