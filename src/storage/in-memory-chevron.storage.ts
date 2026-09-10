import { FeatureValue, ChevronStorage } from '../interfaces';

export class InMemoryChevronStorage implements ChevronStorage {
    private readonly values = new Map<string, FeatureValue>();

    get(feature: string): FeatureValue | undefined {
        return this.values.get(feature);
    }

    set(feature: string, value: FeatureValue): void {
        this.values.set(feature, value);
    }

    delete(feature: string): void {
        this.values.delete(feature);
    }

    purge(features?: string[]): void {
        if (features === undefined) {
            this.values.clear();

            return;
        }

        for (const feature of features) {
            this.values.delete(feature);
        }
    }
}
