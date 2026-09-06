import { Injectable } from '@nestjs/common';
import { ChevronRegistry } from './chevron.registry';
import { FeatureResolver, FeatureValue } from './interfaces';

@Injectable()
export class ChevronService {
    constructor(private readonly registry: ChevronRegistry) {}

    define(feature: string, resolver: FeatureResolver): void {
        this.registry.define(feature, resolver);
    }

    defined(): string[] {
        return this.registry.defined();
    }

    value(feature: string): Promise<FeatureValue | false> {
        return this.registry.value(feature);
    }

    active(feature: string): Promise<boolean> {
        return this.registry.active(feature);
    }

    inactive(feature: string): Promise<boolean> {
        return this.registry.inactive(feature);
    }

    activate(feature: string, featureValue: FeatureValue = true): Promise<void> {
        return this.registry.activate(feature, featureValue);
    }

    deactivate(feature: string): Promise<void> {
        return this.registry.deactivate(feature);
    }

    forget(feature: string): Promise<void> {
        return this.registry.forget(feature);
    }

    purge(features?: string[]): Promise<void> {
        return this.registry.purge(features);
    }
}
