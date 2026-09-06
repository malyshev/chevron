import type { Config } from 'jest';
import rootPreset from '../../jest.preset.js';

export default {
    ...rootPreset,
    displayName: 'sample-000-in-memory-app',
    rootDir: 'src',
    coverageDirectory: '../coverage',
} satisfies Config;
