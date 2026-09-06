import { GLOBAL_NULL_SCOPE } from '../chevron.constants';
import { InMemoryChevronStorage } from './in-memory-chevron.storage';

describe('InMemoryChevronStorage', () => {
    it('purge removes only the exact feature name', () => {
        const storage = new InMemoryChevronStorage();

        storage.set('bill', GLOBAL_NULL_SCOPE, true);
        storage.set('billing', GLOBAL_NULL_SCOPE, false);

        storage.purge(['bill']);

        expect(storage.get('bill', GLOBAL_NULL_SCOPE)).toBeUndefined();
        expect(storage.get('billing', GLOBAL_NULL_SCOPE)).toBe(false);
    });

    it('purge removes feature names that contain colons', () => {
        const storage = new InMemoryChevronStorage();

        storage.set('billing', GLOBAL_NULL_SCOPE, false);
        storage.set('billing:invoices', GLOBAL_NULL_SCOPE, true);

        storage.purge(['billing']);

        expect(storage.get('billing', GLOBAL_NULL_SCOPE)).toBeUndefined();
        expect(storage.get('billing:invoices', GLOBAL_NULL_SCOPE)).toBe(true);
    });
});
