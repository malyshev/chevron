import { FeatureValue } from './chevron-resolver.type';

export interface ChevronStorage {
    get(feature: string, scope: string): FeatureValue | undefined | Promise<FeatureValue | undefined>;

    set(feature: string, scope: string, value: FeatureValue): void | Promise<void>;

    delete(feature: string, scope: string): void | Promise<void>;

    purge(features?: string[]): void | Promise<void>;

    destroy?(): void | Promise<void>;

    onModuleDestroy?(): void | Promise<void>;
}
