// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * @typedef {object} NestjsEslintConfigOptions
 * @property {string} [tsconfigRootDir]
 * @property {string[]} [ignores]
 */

/**
 * @param {NestjsEslintConfigOptions} [options]
 * @returns {import('eslint').Linter.Config[]}
 */
export function createNestjsEslintConfig(options = {}) {
    const tsconfigRootDir = options.tsconfigRootDir ?? import.meta.dirname;

    return [
        {
            ignores: [
                '**/dist/**',
                '**/node_modules/**',
                '**/coverage/**',
                '**/eslint.config.mjs',
                ...(options.ignores ?? []),
            ],
        },
        eslint.configs.recommended,
        ...tseslint.configs.recommendedTypeChecked,
        eslintPluginPrettierRecommended,
        {
            languageOptions: {
                globals: {
                    ...globals.node,
                    ...globals.jest,
                },
                ecmaVersion: 5,
                sourceType: 'module',
                parserOptions: {
                    projectService: true,
                    tsconfigRootDir,
                },
            },
            rules: {
                'max-len': [
                    'warn',
                    {
                        code: 120,
                        ignoreUrls: true,
                        ignoreStrings: true,
                        ignoreTemplateLiterals: true,
                        ignoreComments: true,
                        ignoreRegExpLiterals: true,
                    },
                ],
            },
        },
        {
            rules: {
                '@typescript-eslint/no-floating-promises': 'off',
                '@typescript-eslint/no-unsafe-argument': 'off',
                '@typescript-eslint/interface-name-prefix': 'off',
                '@typescript-eslint/explicit-function-return-type': 'off',
                '@typescript-eslint/explicit-module-boundary-types': 'off',
                '@typescript-eslint/no-explicit-any': 'off',
            },
        },
        {
            files: ['**/*.spec.ts', '**/*.e2e-spec.ts', '**/*.test.ts'],
            rules: {
                '@typescript-eslint/no-unsafe-assignment': 'off',
                '@typescript-eslint/no-unsafe-member-access': 'off',
                '@typescript-eslint/no-unsafe-call': 'off',
                '@typescript-eslint/no-unsafe-return': 'off',
                '@typescript-eslint/no-unsafe-argument': 'off',
                '@typescript-eslint/unbound-method': 'off',
                '@typescript-eslint/require-await': 'off',
                '@typescript-eslint/no-floating-promises': 'off',
            },
        },
    ];
}

/** @type {import('eslint').Linter.Config[]} */
export const config = createNestjsEslintConfig();
