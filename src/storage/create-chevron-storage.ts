import { ChevronStorage, ChevronStorageDriverOptions } from '../interfaces';
import { assertStorageOptionKeys } from './assert-storage-option-keys';
import { EnvChevronStorage } from './env-chevron.storage';
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
        assertStorageOptionKeys(options, ['driver'], 'Memory storage driver');

        return new InMemoryChevronStorage();
    }

    if (options.driver === 'env') {
        assertStorageOptionKeys(options, ['driver', 'prefix', 'env'], 'Env storage driver');

        return new EnvChevronStorage({
            prefix: options.prefix,
            env: options.env,
        });
    }

    throw new TypeError(`Unknown chevron storage driver "${String(driver)}".`);
}
