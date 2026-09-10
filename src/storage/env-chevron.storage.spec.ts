import { EnvChevronStorage } from './env-chevron.storage';

describe('EnvChevronStorage', () => {
    const createStorage = (env: Record<string, string | undefined>): EnvChevronStorage => {
        return new EnvChevronStorage({ prefix: 'FEATURE_', env });
    };

    it('loads prefix-scanned keys as camelCase features', () => {
        const storage = createStorage({
            FEATURE_USE_NEW_API: 'true',
            FEATURE_LARGE_AVATARS: 'false',
            FEATURE_BETA: 'on',
            OTHER_FLAG: 'true',
        });

        expect(storage.get('useNewApi')).toBe(true);
        expect(storage.get('largeAvatars')).toBe(false);
        expect(storage.get('beta')).toBe(true);
        expect(storage.get('otherFlag')).toBeUndefined();
    });

    it('coerces boolean tokens', () => {
        const storage = createStorage({
            FEATURE_TRUE: 'true',
            FEATURE_FALSE: 'false',
            FEATURE_ONE: '1',
            FEATURE_ZERO: '0',
            FEATURE_EMPTY: '',
        });

        expect(storage.get('true')).toBe(true);
        expect(storage.get('false')).toBe(false);
        expect(storage.get('one')).toBe(true);
        expect(storage.get('zero')).toBe(false);
        expect(storage.get('empty')).toBe(false);
    });

    it('treats 0 as boolean false and 0.0 as number zero', () => {
        const storage = createStorage({
            FEATURE_ZERO: '0',
            FEATURE_ZERO_POINT: '0.0',
        });

        expect(storage.get('zero')).toBe(false);
        expect(storage.get('zeroPoint')).toBe(0);
    });

    it('treats 1 as boolean true and 1.0 as number one', () => {
        const storage = createStorage({
            FEATURE_ONE: '1',
            FEATURE_ONE_POINT: '1.0',
        });

        expect(storage.get('one')).toBe(true);
        expect(storage.get('onePoint')).toBe(1);
    });

    it('stores integer numeric strings as numbers', () => {
        const storage = createStorage({
            FEATURE_LIMIT: '100',
        });

        expect(storage.get('limit')).toBe(100);
    });

    it('skips empty suffix, underscore-only suffix, and undefined values', () => {
        const storage = createStorage({
            FEATURE_: 'true',
            FEATURE__: 'true',
            FEATURE_PRESENT: undefined,
            FEATURE_READY: 'yes',
        });

        expect(storage.get('ready')).toBe(true);
        expect(storage.get('')).toBeUndefined();
    });

    it('camelCases a suffix that starts with an underscore', () => {
        const storage = new EnvChevronStorage({
            prefix: 'FEATURE',
            env: { FEATURE_USE_NEW_API: 'true', FEATURE__BETA: 'true' },
        });

        expect(storage.get('useNewApi')).toBe(true);
        expect(storage.get('beta')).toBe(true);
        expect(storage.get('UseNewApi')).toBeUndefined();
    });

    it('rejects unknown constructor option keys', () => {
        expect(
            () =>
                new EnvChevronStorage({
                    prefix: 'FEATURE_',
                    env: {},
                    envs: {},
                } as never),
        ).toThrow('Env storage driver does not accept "envs".');
    });

    it('throws when prefix is not a string', () => {
        expect(() => new EnvChevronStorage({ prefix: 1 as never, env: {} })).toThrow(
            'Env storage driver requires a non-empty prefix.',
        );
    });

    it('throws when two keys map to the same feature name', () => {
        expect(() =>
            createStorage({
                FEATURE_USE_NEW_API: 'true',
                FEATURE_use_new_api: 'false',
            }),
        ).toThrow('map to the same feature name "useNewApi"');
    });

    it('throws when prefix is empty', () => {
        expect(() => new EnvChevronStorage({ prefix: '', env: {} })).toThrow(
            'Env storage driver requires a non-empty prefix.',
        );
    });

    it('mutates the in-memory map without changing the env fixture', () => {
        const env = { FEATURE_USE_NEW_API: 'true' };
        const storage = createStorage(env);

        storage.set('useNewApi', false);
        expect(storage.get('useNewApi')).toBe(false);
        expect(env.FEATURE_USE_NEW_API).toBe('true');

        storage.delete('useNewApi');
        expect(storage.get('useNewApi')).toBeUndefined();
        expect(env.FEATURE_USE_NEW_API).toBe('true');

        storage.set('useNewApi', true);
        storage.purge(['useNewApi']);
        expect(storage.get('useNewApi')).toBeUndefined();
        expect(env.FEATURE_USE_NEW_API).toBe('true');
    });

    it('does not match a prefix case-insensitively', () => {
        const storage = createStorage({
            feature_use_new_api: 'true',
        });

        expect(storage.get('useNewApi')).toBeUndefined();
    });

    describe('without an env fixture', () => {
        afterEach(() => {
            delete process.env.CHEVRON_SPEC_USE_NEW_API;
        });

        it('scans process.env', () => {
            process.env.CHEVRON_SPEC_USE_NEW_API = 'true';

            const storage = new EnvChevronStorage({ prefix: 'CHEVRON_SPEC_' });

            expect(storage.get('useNewApi')).toBe(true);
        });
    });
});
