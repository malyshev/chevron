import { Controller, Injectable, Logger, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UnknownElementException } from '@nestjs/core/errors/exceptions';
import { ChevronModule } from './chevron.module';
import { ChevronCoreModule } from './chevron-core.module';
import { ChevronService } from './chevron.service';
import { getChevronToken, InjectChevron } from './utils/chevron.utils';
import { resetRegisteredGateNamesForTesting } from './utils/chevron-process-state';
import { InMemoryChevronStorage } from './storage/in-memory-chevron.storage';
import { ChevronStorage } from './interfaces';

const CUSTOM_STORAGE = Symbol('CustomChevronStorage');

describe('ChevronModule', () => {
    afterEach(() => {
        resetRegisteredGateNamesForTesting();
    });

    it('defaults to in-memory storage when storage is omitted', async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [ChevronModule.forRoot()],
        }).compile();

        const service = moduleRef.get(ChevronService);

        service.define('example', () => true);

        await expect(service.active('example')).resolves.toBe(true);
    });

    it('provides ChevronService with in-memory storage', async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                ChevronModule.forRoot({
                    storage: InMemoryChevronStorage,
                }),
            ],
        }).compile();

        const service = moduleRef.get(ChevronService);

        service.define('example', () => true);

        await expect(service.active('example')).resolves.toBe(true);
    });

    it('bootstraps features from module options', async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                ChevronModule.forRoot({
                    features: {
                        'beta-api': true,
                    },
                }),
            ],
        }).compile();

        const service = moduleRef.get(ChevronService);

        await expect(service.active('beta-api')).resolves.toBe(true);
    });

    it('injects default gate without token argument', async () => {
        @Injectable()
        class Consumer {
            constructor(@InjectChevron() readonly features: ChevronService) {}
        }

        const moduleRef = await Test.createTestingModule({
            imports: [ChevronModule.forRoot()],
            providers: [Consumer],
        }).compile();

        const consumer = moduleRef.get(Consumer);

        expect(consumer.features).toBeInstanceOf(ChevronService);
    });

    it('throws when default gate is registered twice', async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [ChevronModule.forRoot(), ChevronModule.forRoot()],
        }).compile();

        let initError: Error | undefined;

        try {
            await moduleRef.init();
        } catch (error) {
            initError = error as Error;
        }

        expect(initError?.message).toBe('Chevron "default" is already registered.');
    });

    it('throws when name is explicitly set to "default"', async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                ChevronModule.forRoot({
                    name: 'default',
                }),
            ],
        }).compile();

        let initError: Error | undefined;

        try {
            await moduleRef.init();
        } catch (error) {
            initError = error as Error;
        }

        expect(initError?.message).toBe('Omit "name" for the default gate instead of using name: "default".');
    });

    it('releases gate registration when module bootstrap fails', async () => {
        @Injectable()
        class BrokenOnInit {
            onModuleInit(): void {
                throw new Error('bootstrap failed');
            }
        }

        @Module({
            imports: [
                ChevronModule.forRoot({
                    name: 'billing',
                }),
            ],
            providers: [BrokenOnInit],
        })
        class BrokenModule {}

        const brokenRef = await Test.createTestingModule({
            imports: [BrokenModule],
        }).compile();

        let initError: Error | undefined;

        try {
            await brokenRef.init();
        } catch (error) {
            initError = error as Error;
        }

        expect(initError?.message).toBe('bootstrap failed');

        const moduleRef = await Test.createTestingModule({
            imports: [
                ChevronModule.forRoot({
                    name: 'billing',
                }),
            ],
        }).compile();

        await moduleRef.init();
        await moduleRef.close();
    });

    it('registers gate asynchronously without explicit storage', async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                ChevronModule.forRootAsync({
                    useFactory: () => ({
                        features: {
                            'beta-api': true,
                        },
                    }),
                }),
            ],
        }).compile();

        const service = moduleRef.get(ChevronService);

        await expect(service.active('beta-api')).resolves.toBe(true);
    });

    it('calls destroy on storage during application shutdown', async () => {
        const destroy = jest.fn();

        class DestroyableStorage extends InMemoryChevronStorage implements ChevronStorage {
            destroy(): void {
                destroy();
            }
        }

        const moduleRef = await Test.createTestingModule({
            imports: [
                ChevronModule.forRoot({
                    storage: DestroyableStorage,
                }),
            ],
        }).compile();

        await moduleRef.close();

        expect(destroy).toHaveBeenCalledTimes(1);
    });

    it('releases the gate name when storage is missing on shutdown', async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [ChevronModule.forRoot()],
        }).compile();

        const core = moduleRef.get(ChevronCoreModule);
        const coreModuleRef = (core as unknown as { moduleRef: { get: (...args: never[]) => unknown } }).moduleRef;
        jest.spyOn(coreModuleRef, 'get').mockImplementation(() => {
            throw new UnknownElementException('ChevronStorage');
        });

        await expect(core.onApplicationShutdown()).resolves.toBeUndefined();

        const second = await Test.createTestingModule({
            imports: [ChevronModule.forRoot()],
        }).compile();

        await expect(second.init()).resolves.toBeDefined();
        await second.close();
        await moduleRef.close();
    });

    it('logs unexpected storage lookup errors on shutdown', async () => {
        const loggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
        const moduleRef = await Test.createTestingModule({
            imports: [ChevronModule.forRoot()],
        }).compile();

        const core = moduleRef.get(ChevronCoreModule);
        const coreModuleRef = (core as unknown as { moduleRef: { get: (...args: never[]) => unknown } }).moduleRef;
        jest.spyOn(coreModuleRef, 'get').mockImplementation(() => {
            throw new Error('storage factory exploded');
        });

        try {
            await expect(core.onApplicationShutdown()).resolves.toBeUndefined();
            expect(loggerError).toHaveBeenCalledWith('storage factory exploded');
        } finally {
            loggerError.mockRestore();
        }

        await moduleRef.close();
    });

    it('registers a named gate with an isolated service token', async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                ChevronModule.forRoot({
                    name: 'billing',
                    features: {
                        invoices: true,
                    },
                }),
            ],
        }).compile();

        const billing = moduleRef.get<ChevronService>(getChevronToken('billing'));

        await expect(billing.active('invoices')).resolves.toBe(true);
    });

    it('injects a non-global named gate in the module that imports ChevronModule', async () => {
        @Injectable()
        class BillingConsumer {
            constructor(@InjectChevron('billing') readonly billing: ChevronService) {}
        }

        @Module({
            imports: [
                ChevronModule.forRoot({
                    name: 'billing',
                    features: {
                        invoices: true,
                    },
                }),
            ],
            providers: [BillingConsumer],
        })
        class HostModule {}

        const moduleRef = await Test.createTestingModule({
            imports: [HostModule],
        }).compile();

        const consumer = moduleRef.get(BillingConsumer);

        await expect(consumer.billing.active('invoices')).resolves.toBe(true);
    });

    it('injects a global named gate without re-importing the module', async () => {
        @Injectable()
        class BillingConsumer {
            constructor(@InjectChevron('billing') readonly billing: ChevronService) {}
        }

        @Module({
            imports: [
                ChevronModule.forRoot({
                    name: 'billing',
                    isGlobal: true,
                    features: {
                        invoices: true,
                    },
                }),
            ],
        })
        class RootModule {}

        @Module({
            providers: [BillingConsumer],
        })
        class ChildModule {}

        const moduleRef = await Test.createTestingModule({
            imports: [RootModule, ChildModule],
        }).compile();

        const consumer = moduleRef.get(BillingConsumer);

        await expect(consumer.billing.active('invoices')).resolves.toBe(true);
    });

    it('uses storageFactory on async registration', async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                ChevronModule.forRootAsync({
                    storageFactory: () => new InMemoryChevronStorage(),
                    useFactory: () => ({
                        features: {
                            'async-storage-factory': true,
                        },
                    }),
                }),
            ],
        }).compile();

        const service = moduleRef.get(ChevronService);

        await expect(service.active('async-storage-factory')).resolves.toBe(true);
    });

    it('resolves an optional storage useFactory inject dependency to undefined when absent', async () => {
        const OPTIONAL_DEP = Symbol('OptionalStorageDep');

        const moduleRef = await Test.createTestingModule({
            imports: [
                ChevronModule.forRootAsync({
                    useFactory: () => ({
                        storage: {
                            useFactory: (optionalDep: unknown): ChevronStorage => {
                                expect(optionalDep).toBeUndefined();

                                return new InMemoryChevronStorage();
                            },
                            inject: [{ token: OPTIONAL_DEP, optional: true }],
                        },
                        features: {
                            'optional-inject': true,
                        },
                    }),
                }),
            ],
        }).compile();

        const service = moduleRef.get(ChevronService);

        await expect(service.active('optional-inject')).resolves.toBe(true);
    });

    it('merges extraProviders into the core module', async () => {
        @Injectable()
        class CustomStorage extends InMemoryChevronStorage {}

        const moduleRef = await Test.createTestingModule({
            imports: [
                ChevronModule.forRootAsync({
                    extraProviders: [{ provide: CUSTOM_STORAGE, useClass: CustomStorage }],
                    useFactory: () => ({
                        storage: { useExisting: CUSTOM_STORAGE },
                        features: {
                            'custom-storage': true,
                        },
                    }),
                }),
            ],
        }).compile();

        const service = moduleRef.get(ChevronService);

        await expect(service.active('custom-storage')).resolves.toBe(true);
    });

    it('requires top-level async name when factory returns a custom gate name', async () => {
        await expect(
            Test.createTestingModule({
                imports: [
                    ChevronModule.forRootAsync({
                        useFactory: () => ({
                            name: 'billing',
                            features: {
                                invoices: true,
                            },
                        }),
                    }),
                ],
            }).compile(),
        ).rejects.toThrow(
            'Named chevrons require top-level "name" on forRootAsync when the factory returns a custom gate name.',
        );
    });

    it('registers async named gate when top-level name matches factory return', async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                ChevronModule.forRootAsync({
                    name: 'billing',
                    useFactory: () => ({
                        name: 'billing',
                        features: {
                            invoices: true,
                        },
                    }),
                }),
            ],
        }).compile();

        const billing = moduleRef.get<ChevronService>(getChevronToken('billing'));

        await expect(billing.active('invoices')).resolves.toBe(true);
    });

    it('throws when named gate is registered twice', async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [ChevronModule.forRoot({ name: 'billing' }), ChevronModule.forRoot({ name: 'billing' })],
        }).compile();

        let initError: Error | undefined;

        try {
            await moduleRef.init();
        } catch (error) {
            initError = error as Error;
        }

        expect(initError?.message).toBe('Chevron "billing" is already registered.');
    });

    it('injects default gate globally into child modules', async () => {
        @Injectable()
        class DefaultConsumer {
            constructor(@InjectChevron() readonly features: ChevronService) {}
        }

        @Module({
            imports: [
                ChevronModule.forRoot({
                    features: {
                        'beta-api': true,
                    },
                }),
            ],
        })
        class RootModule {}

        @Module({
            providers: [DefaultConsumer],
        })
        class ChildModule {}

        const moduleRef = await Test.createTestingModule({
            imports: [RootModule, ChildModule],
        }).compile();

        const consumer = moduleRef.get(DefaultConsumer);

        await expect(consumer.features.active('beta-api')).resolves.toBe(true);
    });

    it('invokes storage onModuleDestroy via Nest provider lifecycle on shutdown', async () => {
        const onModuleDestroy = jest.fn();
        const destroy = jest.fn();

        class LifecycleStorage extends InMemoryChevronStorage implements ChevronStorage {
            onModuleDestroy(): void {
                onModuleDestroy();
            }

            destroy(): void {
                destroy();
            }
        }

        const moduleRef = await Test.createTestingModule({
            imports: [
                ChevronModule.forRoot({
                    storage: LifecycleStorage,
                }),
            ],
        }).compile();

        await moduleRef.close();

        expect(onModuleDestroy).toHaveBeenCalledTimes(1);
        expect(destroy).not.toHaveBeenCalled();
    });

    it('requires top-level async isGlobal when factory returns isGlobal', async () => {
        await expect(
            Test.createTestingModule({
                imports: [
                    ChevronModule.forRootAsync({
                        useFactory: () => ({
                            isGlobal: true,
                        }),
                    }),
                ],
            }).compile(),
        ).rejects.toThrow('Chevrons require top-level "isGlobal" on forRootAsync when the factory returns isGlobal.');
    });

    it('registers async global gate when top-level isGlobal matches factory return', async () => {
        @Injectable()
        class BillingConsumer {
            constructor(@InjectChevron('billing') readonly billing: ChevronService) {}
        }

        @Module({
            imports: [
                ChevronModule.forRootAsync({
                    name: 'billing',
                    isGlobal: true,
                    useFactory: () => ({
                        name: 'billing',
                        isGlobal: true,
                        features: {
                            invoices: true,
                        },
                    }),
                }),
            ],
        })
        class RootModule {}

        @Module({
            providers: [BillingConsumer],
        })
        class ChildModule {}

        const moduleRef = await Test.createTestingModule({
            imports: [RootModule, ChildModule],
        }).compile();

        const consumer = moduleRef.get(BillingConsumer);

        await expect(consumer.billing.active('invoices')).resolves.toBe(true);
    });

    it('uses memory storage driver when storage is { driver: "memory" }', async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                ChevronModule.forRoot({
                    storage: { driver: 'memory' },
                    features: {
                        'driver-memory': true,
                    },
                }),
            ],
        }).compile();

        const service = moduleRef.get(ChevronService);

        await expect(service.active('driver-memory')).resolves.toBe(true);
    });

    it('throws when env storage driver is requested before implementation', async () => {
        await expect(
            Test.createTestingModule({
                imports: [
                    ChevronModule.forRoot({
                        storage: { driver: 'env', prefix: 'FEATURE_' },
                    }),
                ],
            }).compile(),
        ).rejects.toThrow('Env storage driver is not implemented yet.');
    });

    it('allows re-registering a gate after module shutdown', async () => {
        const firstRef = await Test.createTestingModule({
            imports: [ChevronModule.forRoot()],
        }).compile();

        await firstRef.init();
        await firstRef.close();

        const secondRef = await Test.createTestingModule({
            imports: [ChevronModule.forRoot()],
        }).compile();

        await secondRef.init();

        const service = secondRef.get(ChevronService);

        service.define('after-restart', () => true);

        await expect(service.active('after-restart')).resolves.toBe(true);
    });

    it('runs storage destroy on second lifecycle after re-registering a gate', async () => {
        const destroy = jest.fn();

        class DestroyableStorage extends InMemoryChevronStorage implements ChevronStorage {
            destroy(): void {
                destroy();
            }
        }

        const firstRef = await Test.createTestingModule({
            imports: [
                ChevronModule.forRoot({
                    storage: DestroyableStorage,
                }),
            ],
        }).compile();

        await firstRef.init();
        await firstRef.close();
        expect(destroy).toHaveBeenCalledTimes(1);

        const secondRef = await Test.createTestingModule({
            imports: [
                ChevronModule.forRoot({
                    storage: DestroyableStorage,
                }),
            ],
        }).compile();

        await secondRef.init();
        await secondRef.close();

        expect(destroy).toHaveBeenCalledTimes(2);
    });

    it('isolates the same feature name across default and named gates', async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                ChevronModule.forRoot({
                    features: {
                        shared: true,
                    },
                }),
                ChevronModule.forRoot({
                    name: 'billing',
                    features: {
                        shared: false,
                    },
                }),
            ],
        }).compile();

        const defaultGate = moduleRef.get(ChevronService);
        const billingGate = moduleRef.get<ChevronService>(getChevronToken('billing'));

        await expect(defaultGate.active('shared')).resolves.toBe(true);
        await expect(billingGate.active('shared')).resolves.toBe(false);
    });

    it('accepts storage registration as a full Nest useExisting provider', async () => {
        @Injectable()
        class CustomStorage extends InMemoryChevronStorage {}

        const moduleRef = await Test.createTestingModule({
            imports: [
                ChevronModule.forRootAsync({
                    extraProviders: [{ provide: CUSTOM_STORAGE, useClass: CustomStorage }],
                    useFactory: () => ({
                        storage: {
                            provide: CUSTOM_STORAGE,
                            useExisting: CUSTOM_STORAGE,
                        },
                        features: {
                            'provider-use-existing': true,
                        },
                    }),
                }),
            ],
        }).compile();

        const service = moduleRef.get(ChevronService);

        await expect(service.active('provider-use-existing')).resolves.toBe(true);
    });

    it('accepts storage registration as a full Nest useClass provider', async () => {
        @Injectable()
        class CustomStorage extends InMemoryChevronStorage {}

        const moduleRef = await Test.createTestingModule({
            imports: [
                ChevronModule.forRootAsync({
                    extraProviders: [{ provide: CUSTOM_STORAGE, useClass: CustomStorage }],
                    useFactory: () => ({
                        storage: {
                            provide: CUSTOM_STORAGE,
                            useClass: CustomStorage,
                        },
                        features: {
                            'provider-use-class': true,
                        },
                    }),
                }),
            ],
        }).compile();

        const service = moduleRef.get(ChevronService);

        await expect(service.active('provider-use-class')).resolves.toBe(true);
    });

    it('injects default and async named gates on a controller in the importing module', async () => {
        @Controller()
        class SampleController {
            constructor(
                @InjectChevron() readonly defaultGate: ChevronService,
                @InjectChevron('async') readonly asyncGate: ChevronService,
            ) {}
        }

        @Module({
            imports: [
                ChevronModule.forRoot({
                    features: {
                        'default-feature': true,
                    },
                }),
                ChevronModule.forRootAsync({
                    name: 'async',
                    useFactory: () => ({
                        name: 'async',
                        features: {
                            'async-feature': true,
                        },
                    }),
                }),
            ],
            controllers: [SampleController],
        })
        class HostModule {}

        const moduleRef = await Test.createTestingModule({
            imports: [HostModule],
        }).compile();

        const controller = moduleRef.get(SampleController);

        await expect(controller.defaultGate.active('default-feature')).resolves.toBe(true);
        await expect(controller.asyncGate.active('async-feature')).resolves.toBe(true);
    });

    it('does not inject a non-global named gate into a sibling child module', async () => {
        @Injectable()
        class BillingConsumer {
            constructor(@InjectChevron('billing') readonly billing: ChevronService) {}
        }

        @Module({
            imports: [
                ChevronModule.forRoot({
                    name: 'billing',
                    features: {
                        invoices: true,
                    },
                }),
            ],
        })
        class RootModule {}

        @Module({
            providers: [BillingConsumer],
        })
        class ChildModule {}

        await expect(
            Test.createTestingModule({
                imports: [RootModule, ChildModule],
            }).compile(),
        ).rejects.toThrow(/can't resolve dependencies/i);
    });

    it('injects a non-global named gate when the feature module re-exports ChevronModule', async () => {
        @Injectable()
        class BillingConsumer {
            constructor(@InjectChevron('billing') readonly billing: ChevronService) {}
        }

        @Module({
            imports: [
                ChevronModule.forRoot({
                    name: 'billing',
                    features: {
                        invoices: true,
                    },
                }),
            ],
            exports: [ChevronModule],
        })
        class BillingFeatureModule {}

        @Module({
            imports: [BillingFeatureModule],
            providers: [BillingConsumer],
        })
        class AppModule {}

        const moduleRef = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        const consumer = moduleRef.get(BillingConsumer);

        await expect(consumer.billing.active('invoices')).resolves.toBe(true);
    });

    it('does not inject a non-global named gate when the feature module omits exporting ChevronModule', async () => {
        @Injectable()
        class BillingConsumer {
            constructor(@InjectChevron('billing') readonly billing: ChevronService) {}
        }

        @Module({
            imports: [
                ChevronModule.forRoot({
                    name: 'billing',
                    features: {
                        invoices: true,
                    },
                }),
            ],
        })
        class BillingFeatureModule {}

        @Module({
            imports: [BillingFeatureModule],
            providers: [BillingConsumer],
        })
        class AppModule {}

        await expect(
            Test.createTestingModule({
                imports: [AppModule],
            }).compile(),
        ).rejects.toThrow(/can't resolve dependencies/i);
    });
});
