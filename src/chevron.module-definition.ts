import { ConfigurableModuleBuilder } from '@nestjs/common';
import { ChevronModuleOptions } from './interfaces';

export const {
    ConfigurableModuleClass,
    MODULE_OPTIONS_TOKEN: CHEVRON_MODULE_OPTIONS,
    ASYNC_OPTIONS_TYPE,
    OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<ChevronModuleOptions>({
    moduleName: 'Chevron',
})
    .setClassMethodName('forRoot')
    .setFactoryMethodName('createChevronOptions')
    .build();

export type ChevronModuleOptionsType = typeof OPTIONS_TYPE;
export type ChevronModuleAsyncOptionsType = typeof ASYNC_OPTIONS_TYPE;
