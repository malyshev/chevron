import { DynamicModule, Module } from '@nestjs/common';
import { ChevronCoreModule } from './chevron-core.module';
import {
    ConfigurableModuleClass,
    ChevronModuleAsyncOptionsType,
    ChevronModuleOptionsType,
} from './chevron.module-definition';
import { ChevronModuleAsyncOptions } from './interfaces';

@Module({})
export class ChevronModule extends ConfigurableModuleClass {
    static forRoot(options?: ChevronModuleOptionsType): DynamicModule {
        const coreModule = ChevronCoreModule.forRoot(options ?? {});

        return {
            module: ChevronModule,
            imports: [coreModule],
            exports: [coreModule],
        };
    }

    static forRootAsync(options: ChevronModuleAsyncOptionsType & ChevronModuleAsyncOptions): DynamicModule {
        const coreModule = ChevronCoreModule.forRootAsync(options);

        return {
            module: ChevronModule,
            imports: [coreModule],
            exports: [coreModule],
        };
    }
}
