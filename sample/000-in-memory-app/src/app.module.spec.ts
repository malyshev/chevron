import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';
import { AppController } from './app.controller';

describe('AppModule', () => {
    let moduleRef: TestingModule;

    afterEach(async () => {
        delete process.env.FEATURE_ASYNC_ENV;

        if (moduleRef !== undefined) {
            await moduleRef.close();
        }
    });

    it('compiles and wires AppController to default and async chevrons', async () => {
        moduleRef = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        expect(moduleRef.get(AppController)).toBeInstanceOf(AppController);
    });

    it('serves bootstrapped default and async features through AppController', async () => {
        moduleRef = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        const controller = moduleRef.get(AppController);

        await expect(controller.demoFeature()).resolves.toEqual({
            feature: 'demo-feature',
            active: true,
            value: true,
        });

        await expect(controller.asyncEnvFeature()).resolves.toEqual({
            feature: 'async-env-feature',
            active: false,
            value: false,
        });
    });

    it('reads async-env feature from config when FEATURE_ASYNC_ENV is true', async () => {
        process.env.FEATURE_ASYNC_ENV = 'true';

        moduleRef = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        const controller = moduleRef.get(AppController);

        await expect(controller.asyncEnvFeature()).resolves.toEqual({
            feature: 'async-env-feature',
            active: true,
            value: true,
        });
    });
});
