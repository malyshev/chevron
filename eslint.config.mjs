// @ts-check
import { createNestjsEslintConfig } from './tools/eslint/nestjs.mjs';

export default createNestjsEslintConfig({
    tsconfigRootDir: import.meta.dirname,
    ignores: ['eslint.config.mjs', 'tools/eslint/**', 'jest.config.ts', '**/jest.config.ts'],
});
