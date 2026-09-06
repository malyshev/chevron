import {
    DynamicModule,
    Inject,
    InjectionToken,
    Logger,
    Module,
    OnApplicationBootstrap,
    OnApplicationShutdown,
    OnModuleDestroy,
    OnModuleInit,
    Provider,
    Type,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { FactoryProvider } from '@nestjs/common/interfaces/modules/provider.interface';
import {
    assertGateNameAvailable,
    assertGateNameNotExplicitDefault,
    isGateShutdownComplete,
    markGateShutdownComplete,
    releaseRegisteredGateName,
} from './utils/chevron-process-state';
import {
    finalizeAsyncChevronOptions,
    getChevronName,
    getChevronRegistryToken,
    getChevronStorageToken,
    getChevronToken,
    resolveAsyncRegistrationChevronName,
    resolveIsGlobal,
    withDefaultChevronOptions,
} from './utils/chevron.utils';
import { CHEVRON_MODULE_OPTIONS } from './chevron.module-definition';
import { ChevronRegistry } from './chevron.registry';
import { ChevronService } from './chevron.service';
import {
    ChevronModuleAsyncOptions,
    ChevronModuleOptions,
    ChevronOptionsFactory,
    ChevronStorage,
    ChevronStorageRegistration,
} from './interfaces';
import { createChevronStorageFromDriver, isChevronStorageDriverOptions } from './storage/create-chevron-storage';

@Module({})
export class ChevronCoreModule implements OnModuleInit, OnApplicationBootstrap, OnModuleDestroy, OnApplicationShutdown {
    private readonly logger = new Logger(ChevronCoreModule.name);

    constructor(
        @Inject(CHEVRON_MODULE_OPTIONS)
        private readonly options: ChevronModuleOptions,
        private readonly moduleRef: ModuleRef,
    ) {}

    static forRoot(options: Partial<ChevronModuleOptions> = {}): DynamicModule {
        const resolved = withDefaultChevronOptions(options);
        const gateName = getChevronName(resolved);

        return {
            module: ChevronCoreModule,
            global: resolveIsGlobal(resolved),
            providers: [{ provide: CHEVRON_MODULE_OPTIONS, useValue: resolved }, ...this.createGateProviders(gateName)],
            exports: [getChevronToken(gateName)],
        };
    }

    static forRootAsync(asyncOptions: ChevronModuleAsyncOptions): DynamicModule {
        const registrationGateName = resolveAsyncRegistrationChevronName(asyncOptions);

        return {
            module: ChevronCoreModule,
            imports: asyncOptions.imports,
            global: resolveIsGlobal({
                name: asyncOptions.name,
                isGlobal: asyncOptions.isGlobal,
            }),
            providers: [
                ...this.createAsyncOptionsProviders(asyncOptions),
                this.createAsyncStorageProvider(asyncOptions, registrationGateName),
                this.createRegistryProvider(registrationGateName),
                this.createServiceProvider(registrationGateName),
                ...(asyncOptions.extraProviders ?? []),
            ],
            exports: [getChevronToken(registrationGateName)],
        };
    }

    onModuleInit(): void {
        assertGateNameNotExplicitDefault(this.options);
    }

    onApplicationBootstrap(): void {
        assertGateNameAvailable(getChevronName(this.options));
    }

    onModuleDestroy(): void {
        releaseRegisteredGateName(getChevronName(this.options));
    }

    async onApplicationShutdown(): Promise<void> {
        const gateName = getChevronName(this.options);

        if (isGateShutdownComplete(gateName)) {
            return;
        }

        markGateShutdownComplete(gateName);

        try {
            const storage = this.lookupStorage(gateName);

            if (storage === undefined) {
                return;
            }

            if (typeof storage.onModuleDestroy !== 'function' && typeof storage.destroy === 'function') {
                await storage.destroy();
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(message);
        } finally {
            releaseRegisteredGateName(gateName);
        }
    }

    private lookupStorage(gateName: string | symbol): ChevronStorage | undefined {
        try {
            return this.moduleRef.get<ChevronStorage>(getChevronStorageToken(gateName), {
                strict: false,
            });
        } catch (error) {
            if (ChevronCoreModule.isUnknownElementError(error)) {
                return undefined;
            }

            throw error;
        }
    }

    // @nestjs/core is a peer dependency: a hoisting mismatch can hand us an UnknownElementException
    // from a different module instance than the one we'd import, so `instanceof` can't be trusted.
    // The exception's own class name is stable across copies, so match on that instead.
    private static isUnknownElementError(error: unknown): boolean {
        return error instanceof Error && error.constructor.name === 'UnknownElementException';
    }

    private static createGateProviders(gateName: string | symbol): Provider[] {
        return [
            this.createSyncStorageProvider(gateName),
            this.createRegistryProvider(gateName),
            this.createServiceProvider(gateName),
        ];
    }

    private static createSyncStorageProvider(gateName: string | symbol): Provider {
        return {
            provide: getChevronStorageToken(gateName),
            useFactory: (options: ChevronModuleOptions, moduleRef: ModuleRef) =>
                this.instantiateStorage(withDefaultChevronOptions(options).storage, moduleRef),
            inject: [CHEVRON_MODULE_OPTIONS, ModuleRef],
        };
    }

    private static createAsyncStorageProvider(
        asyncOptions: ChevronModuleAsyncOptions,
        gateName: string | symbol,
    ): Provider {
        if (asyncOptions.storageFactory !== undefined) {
            return {
                provide: getChevronStorageToken(gateName),
                useFactory: async (options: ChevronModuleOptions) => asyncOptions.storageFactory!(options),
                inject: [CHEVRON_MODULE_OPTIONS],
            };
        }

        return {
            provide: getChevronStorageToken(gateName),
            useFactory: async (options: ChevronModuleOptions, moduleRef: ModuleRef) =>
                this.instantiateStorage(withDefaultChevronOptions(options).storage, moduleRef),
            inject: [CHEVRON_MODULE_OPTIONS, ModuleRef],
        };
    }

    private static createRegistryProvider(gateName: string | symbol): Provider {
        return {
            provide: getChevronRegistryToken(gateName),
            useFactory: (storage: ChevronStorage, options: ChevronModuleOptions) =>
                this.buildRegistry(storage, options),
            inject: [getChevronStorageToken(gateName), CHEVRON_MODULE_OPTIONS],
        };
    }

    private static createServiceProvider(gateName: string | symbol): Provider {
        return {
            provide: getChevronToken(gateName),
            useFactory: (registry: ChevronRegistry) => new ChevronService(registry),
            inject: [getChevronRegistryToken(gateName)],
        };
    }

    private static createAsyncOptionsProviders(options: ChevronModuleAsyncOptions): Provider[] {
        if (options.useExisting !== undefined || options.useFactory !== undefined) {
            return [this.createAsyncOptionsProvider(options)];
        }

        const useClass = options.useClass as Type<ChevronOptionsFactory>;

        return [this.createAsyncOptionsProvider(options), { provide: useClass, useClass }];
    }

    private static createAsyncOptionsProvider(options: ChevronModuleAsyncOptions): Provider {
        if (options.useFactory !== undefined) {
            return {
                provide: CHEVRON_MODULE_OPTIONS,
                useFactory: async (...args: unknown[]) =>
                    finalizeAsyncChevronOptions(options, await options.useFactory!(...args)),
                inject: options.inject ?? [],
            };
        }

        const inject = [(options.useClass ?? options.useExisting) as Type<ChevronOptionsFactory>];

        return {
            provide: CHEVRON_MODULE_OPTIONS,
            useFactory: async (optionsFactory: ChevronOptionsFactory) =>
                finalizeAsyncChevronOptions(options, await optionsFactory.createChevronOptions(options.name)),
            inject,
        };
    }

    private static buildRegistry(storage: ChevronStorage, options: ChevronModuleOptions): ChevronRegistry {
        const registry = new ChevronRegistry(storage);

        if (options.features !== undefined) {
            registry.bootstrapFeatures(options.features);
        }

        return registry;
    }

    private static instantiateStorage(
        registration: ChevronStorageRegistration,
        moduleRef?: ModuleRef,
    ): ChevronStorage | Promise<ChevronStorage> {
        if (typeof registration === 'function') {
            return this.createStorageInstance(registration, moduleRef);
        }

        if (this.isUseClassShorthand(registration)) {
            return this.createStorageInstance(registration.useClass, moduleRef);
        }

        if (this.isUseFactoryShorthand(registration)) {
            return this.invokeStorageFactory(registration.useFactory, registration.inject, moduleRef);
        }

        if (this.isUseExistingShorthand(registration)) {
            if (moduleRef === undefined) {
                throw new TypeError('Storage useExisting requires module registration with ModuleRef.');
            }

            return moduleRef.get<ChevronStorage>(registration.useExisting, { strict: false });
        }

        if (this.isUseFactoryProvider(registration)) {
            return this.invokeStorageFactory(
                registration.useFactory,
                'inject' in registration ? registration.inject : undefined,
                moduleRef,
            );
        }

        if (this.isUseClassProvider(registration)) {
            return this.createStorageInstance(registration.useClass, moduleRef);
        }

        if (this.isUseExistingProvider(registration)) {
            if (moduleRef === undefined) {
                throw new TypeError('Storage useExisting requires module registration with ModuleRef.');
            }

            return moduleRef.get<ChevronStorage>(registration.useExisting, { strict: false });
        }

        if (isChevronStorageDriverOptions(registration)) {
            return createChevronStorageFromDriver(registration);
        }

        throw new TypeError('Invalid ChevronStorage registration.');
    }

    private static createStorageInstance(
        StorageClass: Type<ChevronStorage>,
        moduleRef?: ModuleRef,
    ): ChevronStorage | Promise<ChevronStorage> {
        if (moduleRef === undefined) {
            return new StorageClass();
        }

        return moduleRef.create(StorageClass);
    }

    private static invokeStorageFactory(
        factory: (...args: unknown[]) => ChevronStorage | Promise<ChevronStorage>,
        inject: FactoryProvider['inject'] | undefined,
        moduleRef?: ModuleRef,
    ): ChevronStorage | Promise<ChevronStorage> {
        if (moduleRef === undefined) {
            throw new TypeError('Storage useFactory requires module registration with ModuleRef.');
        }

        return factory(...this.resolveInjectedDependencies(inject, moduleRef));
    }

    private static resolveInjectedDependencies(
        dependencies: FactoryProvider['inject'] | undefined,
        moduleRef: ModuleRef,
    ): unknown[] {
        if (dependencies === undefined) {
            return [];
        }

        return dependencies.map((dependency) => {
            if (typeof dependency === 'object' && dependency !== null && 'token' in dependency) {
                if (dependency.optional === true) {
                    return this.getOptional(dependency.token, moduleRef);
                }

                return moduleRef.get(dependency.token, { strict: false });
            }

            return moduleRef.get(dependency, { strict: false });
        });
    }

    private static getOptional(token: InjectionToken, moduleRef: ModuleRef): unknown {
        try {
            return moduleRef.get(token, { strict: false });
        } catch (error) {
            if (this.isUnknownElementError(error)) {
                return undefined;
            }

            throw error;
        }
    }

    private static isUseClassShorthand(
        registration: ChevronStorageRegistration,
    ): registration is { useClass: Type<ChevronStorage> } {
        return (
            typeof registration === 'object' &&
            registration !== null &&
            'useClass' in registration &&
            !('provide' in registration)
        );
    }

    private static isUseFactoryShorthand(registration: ChevronStorageRegistration): registration is {
        useFactory: (...args: unknown[]) => ChevronStorage | Promise<ChevronStorage>;
        inject?: FactoryProvider['inject'];
    } {
        return (
            typeof registration === 'object' &&
            registration !== null &&
            'useFactory' in registration &&
            !('provide' in registration)
        );
    }

    private static isUseExistingShorthand(
        registration: ChevronStorageRegistration,
    ): registration is { useExisting: Type<ChevronStorage> | symbol | string } {
        return (
            typeof registration === 'object' &&
            registration !== null &&
            'useExisting' in registration &&
            !('provide' in registration)
        );
    }

    private static isUseFactoryProvider(
        registration: ChevronStorageRegistration,
    ): registration is Provider<ChevronStorage> & {
        useFactory: (...args: unknown[]) => ChevronStorage | Promise<ChevronStorage>;
    } {
        return (
            typeof registration === 'object' &&
            registration !== null &&
            'provide' in registration &&
            'useFactory' in registration &&
            typeof registration.useFactory === 'function'
        );
    }

    private static isUseClassProvider(
        registration: ChevronStorageRegistration,
    ): registration is Provider<ChevronStorage> & { useClass: Type<ChevronStorage> } {
        return (
            typeof registration === 'object' &&
            registration !== null &&
            'provide' in registration &&
            'useClass' in registration &&
            typeof registration.useClass === 'function'
        );
    }

    private static isUseExistingProvider(
        registration: ChevronStorageRegistration,
    ): registration is Provider<ChevronStorage> & {
        useExisting: Type<ChevronStorage> | symbol | string;
    } {
        return (
            typeof registration === 'object' &&
            registration !== null &&
            'provide' in registration &&
            'useExisting' in registration
        );
    }
}
