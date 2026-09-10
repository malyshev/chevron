import { Module } from '@nestjs/common';
import { ChevronModule } from '@nestwork/chevron';
import { AppController } from './app.controller';

@Module({
    imports: [
        ChevronModule.forRoot({
            storage: { driver: 'env', prefix: 'FEATURE_' },
        }),
    ],
    controllers: [AppController],
})
export class AppModule {}
