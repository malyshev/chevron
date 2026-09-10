import { InMemoryChevronStorage } from './in-memory-chevron.storage';

describe('InMemoryChevronStorage', () => {
    it('purge removes only the exact feature name', () => {
        const storage = new InMemoryChevronStorage();

        storage.set('bill', true);
        storage.set('billing', false);

        storage.purge(['bill']);

        expect(storage.get('bill')).toBeUndefined();
        expect(storage.get('billing')).toBe(false);
    });

    it('purge removes feature names that contain colons', () => {
        const storage = new InMemoryChevronStorage();

        storage.set('billing', false);
        storage.set('billing:invoices', true);

        storage.purge(['billing']);

        expect(storage.get('billing')).toBeUndefined();
        expect(storage.get('billing:invoices')).toBe(true);
    });
});
