import type { Config } from 'jest';
import rootPreset from './jest.preset.js';

export default {
    ...rootPreset,
    displayName: '@nestwork/chevron',
    rootDir: 'src',
    coverageDirectory: 'coverage',
} satisfies Config;
