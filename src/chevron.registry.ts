import { GLOBAL_NULL_SCOPE } from './chevron.constants';
import { FeatureResolver, FeatureResolverFn, FeatureValue, ChevronStorage } from './interfaces';

export class ChevronRegistry {
    private readonly definitions = new Map<string, FeatureResolver>();

    private readonly cache = new Map<string, FeatureValue>();

    private readonly pendingLookups = new Map<string, Promise<FeatureValue | false>>();

    private readonly featureGenerations = new Map<string, number>();

    private globalGeneration = 0;

    constructor(private readonly storage: ChevronStorage) {}

    define(feature: string, resolver: FeatureResolver): void {
        this.definitions.set(feature, resolver);
        this.invalidateFeature(feature);
    }

    defined(): string[] {
        return [...this.definitions.keys()];
    }

    async value(feature: string): Promise<FeatureValue | false> {
        return this.resolveValue(feature);
    }

    async active(feature: string): Promise<boolean> {
        const resolved = await this.resolveValue(feature);

        return resolved !== false;
    }

    async inactive(feature: string): Promise<boolean> {
        const resolved = await this.resolveValue(feature);

        return resolved === false;
    }

    async activate(feature: string, featureValue: FeatureValue = true): Promise<void> {
        const cacheKey = this.cacheKey(feature);

        await this.storage.set(feature, GLOBAL_NULL_SCOPE, featureValue);
        this.bumpGeneration(cacheKey);
        this.cache.set(cacheKey, featureValue);
    }

    async deactivate(feature: string): Promise<void> {
        await this.activate(feature, false);
    }

    async forget(feature: string): Promise<void> {
        const cacheKey = this.cacheKey(feature);

        await this.storage.delete(feature, GLOBAL_NULL_SCOPE);
        this.bumpGeneration(cacheKey);
        this.cache.delete(cacheKey);
    }

    async purge(features?: string[]): Promise<void> {
        await this.storage.purge(features);
        this.clearCache(features);
    }

    bootstrapFeatures(features: Record<string, FeatureResolver>): void {
        for (const [feature, resolver] of Object.entries(features)) {
            this.define(feature, resolver);
        }
    }

    private async resolveValue(feature: string): Promise<FeatureValue | false> {
        const cacheKey = this.cacheKey(feature);

        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey) as FeatureValue;
        }

        const pendingLookup = this.pendingLookups.get(cacheKey);

        if (pendingLookup !== undefined) {
            return pendingLookup;
        }

        const lookup = this.lookupValue(feature, cacheKey);
        this.pendingLookups.set(cacheKey, lookup);

        try {
            return await lookup;
        } finally {
            if (this.pendingLookups.get(cacheKey) === lookup) {
                this.pendingLookups.delete(cacheKey);
            }
        }
    }

    private async lookupValue(feature: string, cacheKey: string): Promise<FeatureValue | false> {
        const generation = this.snapshotGeneration(cacheKey);

        const stored = await this.storage.get(feature, GLOBAL_NULL_SCOPE);

        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey) as FeatureValue;
        }

        if (stored !== undefined) {
            if (this.isCurrentGeneration(cacheKey, generation)) {
                this.cache.set(cacheKey, stored);
            }

            return stored;
        }

        const resolver = this.definitions.get(feature);

        if (resolver === undefined) {
            return false;
        }

        const resolved = await this.resolveDefinition(resolver);

        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey) as FeatureValue;
        }

        if (this.isCurrentGeneration(cacheKey, generation)) {
            await this.storage.set(feature, GLOBAL_NULL_SCOPE, resolved);

            // A mutator may have landed while storage.set() was in flight. ChevronStorage has no
            // compare-and-swap, so our write already physically landed and may have clobbered
            // whatever the mutator wrote; heal it instead of just skipping the cache update.
            if (this.isCurrentGeneration(cacheKey, generation)) {
                this.cache.set(cacheKey, resolved);
            } else {
                await this.healStaleWrite(feature, cacheKey);
            }
        }

        return resolved;
    }

    private async resolveDefinition(resolver: FeatureResolver): Promise<FeatureValue> {
        if (this.isFeatureResolverFn(resolver)) {
            return resolver();
        }

        return resolver;
    }

    private isFeatureResolverFn(resolver: FeatureResolver): resolver is FeatureResolverFn {
        return typeof resolver === 'function';
    }

    private cacheKey(feature: string): string {
        return `${feature}:${GLOBAL_NULL_SCOPE}`;
    }

    private invalidateFeature(feature: string): void {
        const cacheKey = this.cacheKey(feature);

        this.bumpGeneration(cacheKey);
        this.cache.delete(cacheKey);

        const deleted = this.storage.delete(feature, GLOBAL_NULL_SCOPE);

        // define() stays sync, so this delete is fire-and-forget: the old override can still be
        // physically present in storage for a while after we return. A lookup that reads it in
        // that window will re-cache it as if it were current. Once the delete actually succeeds,
        // invalidate again so that stale re-cache doesn't stick around forever. If it instead
        // fails, don't: the override is genuinely still in storage, so bumping generation here
        // would falsely signal "invalidation complete" while masking a real storage failure.
        if (deleted instanceof Promise) {
            void deleted.then(
                () => {
                    this.bumpGeneration(cacheKey);
                    this.cache.delete(cacheKey);
                },
                () => {},
            );
        }
    }

    private clearCache(features?: string[]): void {
        if (features === undefined) {
            this.globalGeneration += 1;
            this.cache.clear();

            return;
        }

        for (const feature of features) {
            this.bumpGeneration(this.cacheKey(feature));
            this.cache.delete(this.cacheKey(feature));
        }
    }

    // ChevronStorage has no compare-and-swap, so a lookup's storage.set() can physically land after
    // a concurrent mutator's write and clobber it. Restore whatever the mutator established: its
    // cached value if it left one (e.g. activate()), otherwise remove the override entirely
    // (e.g. define()/forget()/purge(), which expect no stored override to remain).
    //
    // This heal write is itself just as unguarded as the one it's fixing: another mutator can land
    // while it's in flight and get clobbered in turn. So loop: re-snapshot what's authoritative
    // right before each attempt, and only stop once an attempt lands without anything having
    // changed since its own snapshot. This converges as long as mutations eventually quiesce.
    private async healStaleWrite(feature: string, cacheKey: string): Promise<void> {
        for (;;) {
            const generation = this.snapshotGeneration(cacheKey);
            const hasCacheValue = this.cache.has(cacheKey);
            const cacheValue = this.cache.get(cacheKey) as FeatureValue;

            if (hasCacheValue) {
                await this.storage.set(feature, GLOBAL_NULL_SCOPE, cacheValue);
            } else {
                await this.storage.delete(feature, GLOBAL_NULL_SCOPE);
            }

            if (this.isCurrentGeneration(cacheKey, generation)) {
                return;
            }
        }
    }

    // A lookup in flight when a mutator runs must not persist its (now stale) result: every
    // mutator bumps the affected feature's generation (or the global one for a full purge), and
    // lookupValue rechecks its snapshot before writing to cache/storage.
    private bumpGeneration(cacheKey: string): void {
        this.featureGenerations.set(cacheKey, (this.featureGenerations.get(cacheKey) ?? 0) + 1);
    }

    private snapshotGeneration(cacheKey: string): readonly [number, number] {
        return [this.globalGeneration, this.featureGenerations.get(cacheKey) ?? 0];
    }

    private isCurrentGeneration(cacheKey: string, snapshot: readonly [number, number]): boolean {
        const [snapshotGlobal, snapshotFeature] = snapshot;

        return (
            this.globalGeneration === snapshotGlobal && (this.featureGenerations.get(cacheKey) ?? 0) === snapshotFeature
        );
    }
}
