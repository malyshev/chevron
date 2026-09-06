import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChevronModule } from '@nestwork/chevron';
import { AppController } from './app.controller';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ChevronModule.forRoot({
            features: {
                'demo-feature': true,
                'zero-is-active': 0,
                'computed-feature': () => Date.now() % 2 === 0,
            },
        }),
        ChevronModule.forRootAsync({
            name: 'async',
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                name: 'async',
                features: {
                    'async-env-feature': config.get('FEATURE_ASYNC_ENV') === 'true',
                },
            }),
        }),
    ],
    controllers: [AppController],
})
export class AppModule {}
