import { InMemoryChevronStorage } from './in-memory-chevron.storage';
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

    it('throws for env driver before implementation', () => {
        expect(() => createChevronStorageFromDriver({ driver: 'env', prefix: 'FEATURE_' })).toThrow(
            'Env storage driver is not implemented yet.',
        );
    });

    it('throws for database driver before implementation', () => {
        expect(() => createChevronStorageFromDriver({ driver: 'database' })).toThrow(
            'Database storage driver is not implemented yet.',
        );
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
