import { ChevronStorage, EnvChevronStorageOptions, FeatureValue } from '../interfaces';
import { assertStorageOptionKeys } from './assert-storage-option-keys';
import { InMemoryChevronStorage } from './in-memory-chevron.storage';

const NUMERIC_ENV_VALUE = /^-?\d+(?:\.\d+)?$/;

export class EnvChevronStorage implements ChevronStorage {
    private readonly memory = new InMemoryChevronStorage();

    constructor(options: EnvChevronStorageOptions) {
        assertStorageOptionKeys(options, ['prefix', 'env'], 'Env storage driver');

        if (typeof options.prefix !== 'string' || options.prefix === '') {
            throw new TypeError('Env storage driver requires a non-empty prefix.');
        }

        this.fillFromEnv(options.prefix, options.env ?? process.env);
    }

    get(feature: string): FeatureValue | undefined {
        return this.memory.get(feature);
    }

    set(feature: string, value: FeatureValue): void {
        this.memory.set(feature, value);
    }

    delete(feature: string): void {
        this.memory.delete(feature);
    }

    purge(features?: string[]): void {
        this.memory.purge(features);
    }

    private fillFromEnv(prefix: string, env: Readonly<Record<string, string | undefined>>): void {
        const sourceKeys = new Map<string, string>();

        for (const [key, value] of Object.entries(env)) {
            if (!key.startsWith(prefix) || value === undefined) {
                continue;
            }

            const featureName = toCamelCaseFeatureName(key.slice(prefix.length));

            if (featureName === '') {
                continue;
            }

            const existingKey = sourceKeys.get(featureName);

            if (existingKey !== undefined) {
                throw new TypeError(
                    `Env keys "${existingKey}" and "${key}" map to the same feature name "${featureName}".`,
                );
            }

            sourceKeys.set(featureName, key);
            this.memory.set(featureName, coerceEnvValue(value));
        }
    }
}

function toCamelCaseFeatureName(suffix: string): string {
    const segments = suffix.split('_').filter((segment) => segment.length > 0);

    return segments
        .map((segment, index) => {
            const lower = segment.toLowerCase();

            if (index === 0) {
                return lower;
            }

            return lower.slice(0, 1).toUpperCase() + lower.slice(1);
        })
        .join('');
}

function coerceEnvValue(value: string): FeatureValue {
    const trimmed = value.trim();

    if (trimmed === '') {
        return false;
    }

    const token = trimmed.toLowerCase();

    if (token === 'true' || token === '1' || token === 'yes' || token === 'on') {
        return true;
    }

    if (token === 'false' || token === '0' || token === 'no' || token === 'off') {
        return false;
    }

    if (NUMERIC_ENV_VALUE.test(trimmed)) {
        return Number(trimmed);
    }

    return trimmed;
}
