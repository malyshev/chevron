import { ChevronRegistry } from './chevron.registry';
import { ChevronStorage, FeatureValue } from './interfaces';
import { InMemoryChevronStorage } from './storage/in-memory-chevron.storage';

const GLOBAL_NULL_SCOPE = '__chevron_null__';

function flushMicrotasks(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

// InMemoryChevronStorage's operations complete synchronously, which can't reproduce races that
// only appear when a storage call is genuinely in flight while another operation runs.
class DelayedWriteStorage implements ChevronStorage {
    private readonly values = new Map<string, FeatureValue>();

    private setGate: Promise<void> | null = null;

    private releaseSetGate: (() => void) | null = null;

    private setStarted: (() => void) | null = null;

    private deleteGate: Promise<void> | null = null;

    private releaseDeleteGate: (() => void) | null = null;

    private deleteStarted: (() => void) | null = null;

    // Resolves once the next set() call has actually begun (and captured the gate armed here),
    // so callers can synchronize on that instead of guessing how many microtask ticks it takes.
    armSet(): Promise<void> {
        this.setGate = new Promise((resolve) => {
            this.releaseSetGate = resolve;
        });

        return new Promise((resolve) => {
            this.setStarted = resolve;
        });
    }

    releaseSet(): void {
        this.releaseSetGate?.();
    }

    armDelete(): Promise<void> {
        this.deleteGate = new Promise((resolve) => {
            this.releaseDeleteGate = resolve;
        });

        return new Promise((resolve) => {
            this.deleteStarted = resolve;
        });
    }

    releaseDelete(): void {
        this.releaseDeleteGate?.();
    }

    get(feature: string, scope: string): FeatureValue | undefined {
        return this.values.get(`${feature}:${scope}`);
    }

    async set(feature: string, scope: string, value: FeatureValue): Promise<void> {
        const pending = this.setGate;
        this.setGate = null;
        this.setStarted?.();
        this.setStarted = null;

        if (pending !== null) {
            await pending;
        }

        this.values.set(`${feature}:${scope}`, value);
    }

    async delete(feature: string, scope: string): Promise<void> {
        const pending = this.deleteGate;
        this.deleteGate = null;
        this.deleteStarted?.();
        this.deleteStarted = null;

        if (pending !== null) {
            await pending;
        }

        this.values.delete(`${feature}:${scope}`);
    }

    purge(): void {
        this.values.clear();
    }
}

describe('ChevronRegistry', () => {
    it('resolves defined features with write-through storage', async () => {
        const registry = new ChevronRegistry(new InMemoryChevronStorage());

        registry.define('feature', () => true);

        await expect(registry.active('feature')).resolves.toBe(true);
        await expect(registry.active('feature')).resolves.toBe(true);
    });

    it('treats active as value !== false', async () => {
        const registry = new ChevronRegistry(new InMemoryChevronStorage());

        registry.define('zero', 0);
        registry.define('false', false);

        await expect(registry.active('zero')).resolves.toBe(true);
        await expect(registry.active('false')).resolves.toBe(false);
    });

    it('returns false for unknown features', async () => {
        const registry = new ChevronRegistry(new InMemoryChevronStorage());

        await expect(registry.active('missing')).resolves.toBe(false);
        await expect(registry.value('missing')).resolves.toBe(false);
        await expect(registry.inactive('missing')).resolves.toBe(true);
    });

    it('returns resolved value including non-boolean payloads', async () => {
        const registry = new ChevronRegistry(new InMemoryChevronStorage());

        registry.define('mode', 'beta');

        await expect(registry.value('mode')).resolves.toBe('beta');
        await expect(registry.inactive('mode')).resolves.toBe(false);
    });

    it('lists defined feature names', () => {
        const registry = new ChevronRegistry(new InMemoryChevronStorage());

        registry.define('alpha', true);
        registry.define('beta', () => false);

        expect(registry.defined()).toEqual(['alpha', 'beta']);
    });

    it('forget removes stored override and re-resolves', async () => {
        const registry = new ChevronRegistry(new InMemoryChevronStorage());
        let resolved = false;

        registry.define('feature', () => resolved);

        await registry.activate('feature', true);
        await expect(registry.active('feature')).resolves.toBe(true);

        resolved = false;
        await registry.forget('feature');

        await expect(registry.active('feature')).resolves.toBe(false);
    });

    it('purge clears stored values', async () => {
        const registry = new ChevronRegistry(new InMemoryChevronStorage());

        registry.define('feature', () => true);
        await registry.activate('feature', false);

        await expect(registry.active('feature')).resolves.toBe(false);

        await registry.purge(['feature']);

        await expect(registry.active('feature')).resolves.toBe(true);
    });

    it('purge without feature list clears all stored values', async () => {
        const registry = new ChevronRegistry(new InMemoryChevronStorage());

        registry.define('alpha', () => true);
        registry.define('beta', () => true);
        await registry.activate('alpha', false);
        await registry.activate('beta', false);

        await expect(registry.active('alpha')).resolves.toBe(false);
        await expect(registry.active('beta')).resolves.toBe(false);

        await registry.purge();

        await expect(registry.active('alpha')).resolves.toBe(true);
        await expect(registry.active('beta')).resolves.toBe(true);
    });

    it('deactivate stores false', async () => {
        const registry = new ChevronRegistry(new InMemoryChevronStorage());

        registry.define('feature', () => true);

        await registry.deactivate('feature');

        await expect(registry.active('feature')).resolves.toBe(false);
        await expect(registry.inactive('feature')).resolves.toBe(true);
    });

    it('redefine invalidates cached and stored values', async () => {
        const registry = new ChevronRegistry(new InMemoryChevronStorage());

        registry.define('feature', () => true);
        await expect(registry.active('feature')).resolves.toBe(true);

        registry.define('feature', () => false);

        await expect(registry.active('feature')).resolves.toBe(false);
    });

    it('invokes a resolver once under concurrent first reads', async () => {
        const registry = new ChevronRegistry(new InMemoryChevronStorage());
        let calls = 0;
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });

        registry.define('feature', async () => {
            calls += 1;
            await gate;

            return calls;
        });

        const first = registry.value('feature');
        const second = registry.value('feature');
        release();

        await expect(Promise.all([first, second])).resolves.toEqual([1, 1]);
        expect(calls).toBe(1);
    });

    it('invokes a resolver once when forget races an in-flight read', async () => {
        const registry = new ChevronRegistry(new InMemoryChevronStorage());
        let calls = 0;
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });

        registry.define('feature', async () => {
            calls += 1;
            await gate;

            return true;
        });

        const first = registry.value('feature');
        await registry.forget('feature');
        const second = registry.value('feature');
        release();

        await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
        expect(calls).toBe(1);
    });

    it('does not stick to a stale resolver value when redefined mid-flight', async () => {
        const registry = new ChevronRegistry(new InMemoryChevronStorage());
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });

        registry.define('feature', async () => {
            await gate;

            return 'stale';
        });

        const first = registry.value('feature');

        registry.define('feature', () => 'fresh');
        release();

        await first;

        await expect(registry.value('feature')).resolves.toBe('fresh');
    });

    it('does not stick to a stale resolver value when activated mid-flight', async () => {
        const registry = new ChevronRegistry(new InMemoryChevronStorage());
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });

        registry.define('feature', async () => {
            await gate;

            return 'stale';
        });

        const first = registry.value('feature');

        await registry.activate('feature', 'fresh');
        release();

        await first;

        await expect(registry.value('feature')).resolves.toBe('fresh');
    });

    it('does not stick to a stale resolver value when purged mid-flight', async () => {
        const registry = new ChevronRegistry(new InMemoryChevronStorage());
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });

        registry.define('feature', async () => {
            await gate;

            return 'stale';
        });

        const first = registry.value('feature');

        await registry.purge();
        release();

        await first;

        await expect(registry.value('feature')).resolves.toBe('stale');
    });

    it('heals a stale write that lands in storage after a concurrent activate()', async () => {
        const storage = new DelayedWriteStorage();
        const registry = new ChevronRegistry(storage);

        registry.define('feature', () => 'stale-resolved');
        // define()'s own fire-and-forget delete (nothing to delete for a brand new feature) still
        // schedules a follow-up generation bump once it settles; let it settle first so it doesn't
        // race the scenario below.
        await flushMicrotasks();

        const setStarted = storage.armSet();
        const lookup = registry.value('feature');
        await setStarted;

        await registry.activate('feature', 'fresh-activated');
        storage.releaseSet();
        await lookup;

        await expect(registry.value('feature')).resolves.toBe('fresh-activated');
        expect(storage.get('feature', GLOBAL_NULL_SCOPE)).toBe('fresh-activated');
    });

    it('heals a stale write that lands in storage after a concurrent forget()', async () => {
        const storage = new DelayedWriteStorage();
        const registry = new ChevronRegistry(storage);

        registry.define('feature', () => 'stale-resolved');
        await flushMicrotasks();

        const setStarted = storage.armSet();
        const lookup = registry.value('feature');
        await setStarted;

        await registry.forget('feature');
        storage.releaseSet();
        await lookup;

        expect(storage.get('feature', GLOBAL_NULL_SCOPE)).toBeUndefined();
    });

    it('does not permanently re-cache a stored override that define() is still deleting', async () => {
        const storage = new DelayedWriteStorage();
        const registry = new ChevronRegistry(storage);

        registry.define('feature', () => 'old-resolver-value');
        await flushMicrotasks();
        await registry.value('feature');
        expect(storage.get('feature', GLOBAL_NULL_SCOPE)).toBe('old-resolver-value');

        const deleteStarted = storage.armDelete();
        registry.define('feature', () => 'new-resolver-value');
        await deleteStarted;

        await expect(registry.value('feature')).resolves.toBe('old-resolver-value');

        storage.releaseDelete();
        await new Promise((resolve) => setTimeout(resolve, 0));

        await expect(registry.value('feature')).resolves.toBe('new-resolver-value');
    });

    it("does not undo a fresh write when a redefinition's delete rejects while that write is in flight", async () => {
        // Distinct from a plain "delete always fails" double: get()/set() stay instant so the
        // failure lands at a controlled point relative to a concurrent write, which is the only
        // way to tell "bump generation on reject" (wrong) apart from "don't" (correct) — with an
        // always-failing delete, storage keeps the old value under either behavior, so asserting
        // just the returned value can't catch the regression this guards against.
        class RacingFailingStorage implements ChevronStorage {
            private readonly values = new Map<string, FeatureValue>();

            private setGate: Promise<void> | null = null;

            private releaseSetGate: (() => void) | null = null;

            private setStarted: (() => void) | null = null;

            private deleteGate: Promise<void> | null = null;

            private rejectDeleteGate: ((error: Error) => void) | null = null;

            private deleteStarted: (() => void) | null = null;

            armSet(): Promise<void> {
                this.setGate = new Promise((resolve) => {
                    this.releaseSetGate = resolve;
                });

                return new Promise((resolve) => {
                    this.setStarted = resolve;
                });
            }

            releaseSet(): void {
                this.releaseSetGate?.();
            }

            armFailingDelete(): Promise<void> {
                this.deleteGate = new Promise((_resolve, reject) => {
                    this.rejectDeleteGate = reject;
                });
                this.deleteGate.catch(() => {});

                return new Promise((resolve) => {
                    this.deleteStarted = resolve;
                });
            }

            failDelete(): void {
                this.rejectDeleteGate?.(new Error('connection dropped'));
            }

            get(feature: string, scope: string): FeatureValue | undefined {
                return this.values.get(`${feature}:${scope}`);
            }

            async set(feature: string, scope: string, value: FeatureValue): Promise<void> {
                const pending = this.setGate;
                this.setGate = null;
                this.setStarted?.();
                this.setStarted = null;

                if (pending !== null) {
                    await pending;
                }

                this.values.set(`${feature}:${scope}`, value);
            }

            async delete(feature: string, scope: string): Promise<void> {
                const pending = this.deleteGate;
                this.deleteGate = null;
                this.deleteStarted?.();
                this.deleteStarted = null;

                if (pending !== null) {
                    await pending;
                }

                this.values.delete(`${feature}:${scope}`);
            }

            purge(): void {
                this.values.clear();
            }
        }

        const storage = new RacingFailingStorage();
        const registry = new ChevronRegistry(storage);
        let calls = 0;

        const deleteStarted = storage.armFailingDelete();
        registry.define('feature', () => {
            calls += 1;

            return 'v';
        });
        await deleteStarted;

        const setStarted = storage.armSet();
        const lookup = registry.value('feature');
        await setStarted;

        storage.failDelete();
        await flushMicrotasks();
        await flushMicrotasks();

        storage.releaseSet();
        await lookup;

        expect(calls).toBe(1);
        expect(storage.get('feature', GLOBAL_NULL_SCOPE)).toBe('v');

        // If the rejected delete had falsely bumped generation, healStaleWrite would have found
        // no cache entry and deleted what the write above just stored, forcing a second resolver
        // call here.
        await registry.value('feature');
        expect(calls).toBe(1);
    });

    it('does not let a mutator racing the heal write itself get silently undone', async () => {
        // healStaleWrite's own storage.set()/delete() is exactly as unguarded as the original
        // write it's fixing, so a mutator that lands while the heal is in flight can be clobbered
        // the same way — this pins healStaleWrite's retry loop against that.
        class SequencedGateStorage implements ChevronStorage {
            private readonly values = new Map<string, FeatureValue>();

            private callIndex = 0;

            private readonly gates: Array<Promise<void> | null> = [];

            private readonly releases: Array<(() => void) | null> = [];

            private readonly startSignals: Array<(() => void) | null> = [];

            armSetAt(index: number): Promise<void> {
                this.gates[index] = new Promise((resolve) => {
                    this.releases[index] = resolve;
                });

                return new Promise((resolve) => {
                    this.startSignals[index] = resolve;
                });
            }

            releaseSetAt(index: number): void {
                this.releases[index]?.();
            }

            get(feature: string, scope: string): FeatureValue | undefined {
                return this.values.get(`${feature}:${scope}`);
            }

            async set(feature: string, scope: string, value: FeatureValue): Promise<void> {
                const index = this.callIndex;
                this.callIndex += 1;
                this.startSignals[index]?.();

                const gate = this.gates[index];

                if (gate !== undefined && gate !== null) {
                    await gate;
                }

                this.values.set(`${feature}:${scope}`, value);
            }

            async delete(feature: string, scope: string): Promise<void> {
                this.values.delete(`${feature}:${scope}`);
            }

            purge(): void {
                this.values.clear();
            }
        }

        const storage = new SequencedGateStorage();
        const registry = new ChevronRegistry(storage);

        registry.define('feature', () => 'A');
        await flushMicrotasks();

        // call index 0: the original lookup's write
        const started0 = storage.armSetAt(0);
        const lookup = registry.value('feature');
        await started0;

        // call index 1: activate()'s write - not gated, proceeds immediately
        await registry.activate('feature', 'B');

        // call index 2: heal's own write, gated so a third mutation can race it
        const started2 = storage.armSetAt(2);
        storage.releaseSetAt(0);
        await started2;

        // a third mutation lands while heal's own write is in flight
        await registry.forget('feature');

        storage.releaseSetAt(2);
        await lookup;
        await flushMicrotasks();
        await flushMicrotasks();

        // forget() is the last authoritative mutation: no override should remain, even though
        // heal's own write raced it.
        expect(storage.get('feature', GLOBAL_NULL_SCOPE)).toBeUndefined();
    });
});
