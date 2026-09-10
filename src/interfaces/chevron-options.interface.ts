import { ConfigurableModuleAsyncOptions, FactoryProvider, ModuleMetadata, Provider, Type } from '@nestjs/common';
import { ChevronStorage } from './chevron-storage.interface';
import { FeatureResolver } from './chevron-resolver.type';
import { ChevronStorageDriverOptions } from './chevron-driver-options.interface';

export type {
    ChevronEnvDriverOptions,
    ChevronMemoryDriverOptions,
    ChevronStorageDriverOptions,
} from './chevron-driver-options.interface';

export type ChevronStorageProviderShorthand =
    | { useClass: Type<ChevronStorage> }
    | {
          useFactory: (...args: unknown[]) => ChevronStorage | Promise<ChevronStorage>;
          inject?: FactoryProvider['inject'];
      }
    | { useExisting: Type<ChevronStorage> | symbol | string };

export type ChevronStorageRegistration =
    Type<ChevronStorage> | ChevronStorageProviderShorthand | Provider<ChevronStorage> | ChevronStorageDriverOptions;

export interface ChevronModuleOptions {
    storage?: ChevronStorageRegistration;
    name?: string | symbol;
    features?: Record<string, FeatureResolver>;
    isGlobal?: boolean;
}

export type ChevronStorageFactory = (options: ChevronModuleOptions) => ChevronStorage | Promise<ChevronStorage>;

export interface ChevronModuleAsyncOptions
    extends
        ConfigurableModuleAsyncOptions<ChevronModuleOptions, 'createChevronOptions'>,
        Pick<ModuleMetadata, 'imports'> {
    name?: string | symbol;
    isGlobal?: boolean;
    // Returns a storage instance directly; bypasses `storage` driver normalization in module options.
    storageFactory?: ChevronStorageFactory;
    extraProviders?: Provider[];
}

export interface ChevronOptionsFactory {
    createChevronOptions(name?: string | symbol): Promise<ChevronModuleOptions> | ChevronModuleOptions;
}
