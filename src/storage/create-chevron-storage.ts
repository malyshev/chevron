import { ChevronStorage, ChevronStorageDriverOptions } from '../interfaces';
import { InMemoryChevronStorage } from './in-memory-chevron.storage';

export function isChevronStorageDriverOptions(registration: unknown): registration is ChevronStorageDriverOptions {
    return (
        typeof registration === 'object' &&
        registration !== null &&
        'driver' in registration &&
        !('provide' in registration) &&
        !('useClass' in registration) &&
        !('useFactory' in registration) &&
        !('useExisting' in registration)
    );
}

export function createChevronStorageFromDriver(options: ChevronStorageDriverOptions): ChevronStorage {
    const driver = options.driver ?? 'memory';

    if (driver === 'memory') {
        assertMemoryDriverOptions(options);

        return new InMemoryChevronStorage();
    }

    if (driver === 'env') {
        throw new TypeError('Env storage driver is not implemented yet.');
    }

    if (driver === 'database') {
        throw new TypeError('Database storage driver is not implemented yet.');
    }

    throw new TypeError(`Unknown chevron storage driver "${String(driver)}".`);
}

function assertMemoryDriverOptions(options: ChevronStorageDriverOptions): void {
    if (options.driver !== undefined && options.driver !== 'memory') {
        return;
    }

    const forbiddenKeys = ['prefix', 'overlay', 'nameTransform', 'env'] as const;

    for (const key of forbiddenKeys) {
        if (key in options) {
            throw new TypeError(`Memory storage driver does not accept "${key}".`);
        }
    }
}
