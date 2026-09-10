import { InMemoryChevronStorage } from './in-memory-chevron.storage';
import { EnvChevronStorage } from './env-chevron.storage';
import { createChevronStorageFromDriver, isChevronStorageDriverOptions } from './create-chevron-storage';

describe('createChevronStorageFromDriver', () => {
    it('creates in-memory storage for default memory driver', () => {
        const storage = createChevronStorageFromDriver({ driver: 'memory' });

        expect(storage).toBeInstanceOf(InMemoryChevronStorage);
    });

    it('creates in-memory storage when driver is omitted', () => {
        const storage = createChevronStorageFromDriver({});

        expect(storage).toBeInstanceOf(InMemoryChevronStorage);
    });

    it('rejects env-only options on memory driver', () => {
        expect(() =>
            createChevronStorageFromDriver({
                driver: 'memory',
                prefix: 'FEATURE_',
            } as never),
        ).toThrow('Memory storage driver does not accept "prefix".');
    });

    it('rejects leftover overlay and nameTransform on memory driver', () => {
        expect(() =>
            createChevronStorageFromDriver({
                driver: 'memory',
                overlay: true,
            } as never),
        ).toThrow('Memory storage driver does not accept "overlay".');
        expect(() =>
            createChevronStorageFromDriver({
                driver: 'memory',
                nameTransform: 'camelCase',
            } as never),
        ).toThrow('Memory storage driver does not accept "nameTransform".');
    });

    it('creates env storage filled from the env fixture', () => {
        const storage = createChevronStorageFromDriver({
            driver: 'env',
            prefix: 'FEATURE_',
            env: { FEATURE_USE_NEW_API: 'true' },
        });

        expect(storage).toBeInstanceOf(EnvChevronStorage);
        expect(storage.get('useNewApi')).toBe(true);
    });

    describe('without an env fixture', () => {
        const processEnvKey = 'CHEVRON_FACTORY_SPEC_USE_NEW_API';

        afterEach(() => {
            delete process.env[processEnvKey];
        });

        it('fills env storage from process.env', () => {
            process.env[processEnvKey] = 'true';

            const storage = createChevronStorageFromDriver({
                driver: 'env',
                prefix: 'CHEVRON_FACTORY_SPEC_',
            });

            expect(storage.get('useNewApi')).toBe(true);
        });
    });

    it('throws when env driver is missing a prefix', () => {
        expect(() => createChevronStorageFromDriver({ driver: 'env' } as never)).toThrow(
            'Env storage driver requires a non-empty prefix.',
        );
    });

    it('rejects leftover keys on env driver', () => {
        expect(() =>
            createChevronStorageFromDriver({
                driver: 'env',
                prefix: 'FEATURE_',
                overlay: true,
            } as never),
        ).toThrow('Env storage driver does not accept "overlay".');
    });

    it('throws for unknown driver literals', () => {
        expect(() => createChevronStorageFromDriver({ driver: 'redis' } as never)).toThrow(
            'Unknown chevron storage driver "redis".',
        );
    });
});

describe('isChevronStorageDriverOptions', () => {
    it('detects driver option objects', () => {
        expect(isChevronStorageDriverOptions({ driver: 'memory' })).toBe(true);
    });

    it('rejects Nest provider shorthands', () => {
        expect(isChevronStorageDriverOptions({ useClass: InMemoryChevronStorage })).toBe(false);
        expect(isChevronStorageDriverOptions({ useFactory: () => new InMemoryChevronStorage() })).toBe(false);
        expect(isChevronStorageDriverOptions({ useExisting: 'token' })).toBe(false);
    });

    it('rejects full Nest providers', () => {
        expect(
            isChevronStorageDriverOptions({
                provide: 'token',
                useExisting: 'other',
            }),
        ).toBe(false);
    });
});
