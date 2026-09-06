import { Inject, Type } from '@nestjs/common';
import { DEFAULT_CHEVRON_NAME } from '../chevron.constants';
import { ChevronService } from '../chevron.service';
import {
    ChevronMemoryDriverOptions,
    ChevronModuleAsyncOptions,
    ChevronModuleOptions,
    ChevronStorageRegistration,
} from '../interfaces';

export function getChevronName(options: Pick<ChevronModuleOptions, 'name'>): string | symbol {
    return options.name ?? DEFAULT_CHEVRON_NAME;
}

export function resolveIsGlobal(options: Pick<ChevronModuleOptions, 'name' | 'isGlobal'>): boolean {
    if (options.isGlobal !== undefined) {
        return options.isGlobal;
    }

    return options.name === undefined;
}

export function resolveAsyncRegistrationChevronName(asyncOptions: ChevronModuleAsyncOptions): string | symbol {
    return asyncOptions.name ?? DEFAULT_CHEVRON_NAME;
}

export function getChevronToken(name: string | symbol = DEFAULT_CHEVRON_NAME): string | Type<ChevronService> {
    if (name === DEFAULT_CHEVRON_NAME) {
        return ChevronService;
    }

    return `${String(name)}ChevronService`;
}

export function getChevronStorageToken(name: string | symbol = DEFAULT_CHEVRON_NAME): symbol {
    return Symbol.for(`ChevronStorage:${String(name)}`);
}

export function getChevronRegistryToken(name: string | symbol = DEFAULT_CHEVRON_NAME): symbol {
    return Symbol.for(`ChevronRegistry:${String(name)}`);
}

export type ResolvedChevronModuleOptions = ChevronModuleOptions & {
    storage: ChevronStorageRegistration;
};

export function withDefaultChevronOptions(options: Partial<ChevronModuleOptions> = {}): ResolvedChevronModuleOptions {
    const defaultStorage: ChevronMemoryDriverOptions = { driver: 'memory' };

    return {
        ...options,
        storage: options.storage ?? defaultStorage,
    };
}

export function mergeAsyncChevronOptions(
    asyncOptions: ChevronModuleAsyncOptions,
    resolvedOptions: Partial<ChevronModuleOptions>,
): ResolvedChevronModuleOptions {
    const merged: Partial<ChevronModuleOptions> = { ...resolvedOptions };

    if (asyncOptions.name !== undefined) {
        merged.name = asyncOptions.name;
    }

    if (asyncOptions.isGlobal !== undefined) {
        merged.isGlobal = asyncOptions.isGlobal;
    }

    return withDefaultChevronOptions(merged);
}

export function finalizeAsyncChevronOptions(
    asyncOptions: ChevronModuleAsyncOptions,
    resolvedOptions: Partial<ChevronModuleOptions>,
): ResolvedChevronModuleOptions {
    const merged = mergeAsyncChevronOptions(asyncOptions, resolvedOptions);
    const registrationName = resolveAsyncRegistrationChevronName(asyncOptions);
    const effectiveName = getChevronName(merged);

    if (String(registrationName) !== String(effectiveName)) {
        throw new Error(
            'Named chevrons require top-level "name" on forRootAsync when the factory returns a custom gate name.',
        );
    }

    if (resolvedOptions.isGlobal !== undefined && asyncOptions.isGlobal === undefined) {
        throw new Error('Chevrons require top-level "isGlobal" on forRootAsync when the factory returns isGlobal.');
    }

    if (
        resolvedOptions.isGlobal !== undefined &&
        asyncOptions.isGlobal !== undefined &&
        resolvedOptions.isGlobal !== asyncOptions.isGlobal
    ) {
        throw new Error('Conflicting "isGlobal" values between forRootAsync options and factory return.');
    }

    return merged;
}

export const InjectChevron = (name: string | symbol = DEFAULT_CHEVRON_NAME): ReturnType<typeof Inject> =>
    Inject(getChevronToken(name));
