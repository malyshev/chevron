import type { Config } from 'jest';
import rootPreset from '../../jest.preset.js';

export default {
    ...rootPreset,
    displayName: 'sample-001-env-storage-sample',
    rootDir: 'src',
    coverageDirectory: '../coverage',
} satisfies Config;
