import { FeatureValue, ChevronStorage } from '../interfaces';

export class InMemoryChevronStorage implements ChevronStorage {
    private readonly values = new Map<string, FeatureValue>();

    get(feature: string, scope: string): FeatureValue | undefined {
        return this.values.get(this.key(feature, scope));
    }

    set(feature: string, scope: string, value: FeatureValue): void {
        this.values.set(this.key(feature, scope), value);
    }

    delete(feature: string, scope: string): void {
        this.values.delete(this.key(feature, scope));
    }

    purge(features?: string[]): void {
        if (features === undefined) {
            this.values.clear();

            return;
        }

        for (const key of [...this.values.keys()]) {
            if (features.includes(this.featureFromKey(key))) {
                this.values.delete(key);
            }
        }
    }

    private featureFromKey(key: string): string {
        const separatorIndex = key.lastIndexOf(':');

        return key.slice(0, separatorIndex);
    }

    private key(feature: string, scope: string): string {
        return `${feature}:${scope}`;
    }
}
