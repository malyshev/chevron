import { Test, TestingModule } from '@nestjs/testing';
import { ChevronModule } from '@nestwork/chevron';
import { AppController } from './app.controller';

describe('AppModule', () => {
    let moduleRef: TestingModule;

    afterEach(async () => {
        if (moduleRef !== undefined) {
            await moduleRef.close();
        }
    });

    it('resolves env-only flags from process.env without define', async () => {
        process.env.FEATURE_USE_NEW_API = 'true';
        process.env.FEATURE_LARGE_AVATARS = 'false';

        try {
            moduleRef = await Test.createTestingModule({
                imports: [
                    ChevronModule.forRoot({
                        storage: {
                            driver: 'env',
                            prefix: 'FEATURE_',
                        },
                    }),
                ],
                controllers: [AppController],
            }).compile();
        } finally {
            delete process.env.FEATURE_USE_NEW_API;
            delete process.env.FEATURE_LARGE_AVATARS;
        }

        const controller = moduleRef.get(AppController);

        await expect(controller.useNewApi()).resolves.toEqual({
            feature: 'useNewApi',
            active: true,
            value: true,
        });

        await expect(controller.largeAvatars()).resolves.toEqual({
            feature: 'largeAvatars',
            active: false,
            value: false,
        });
    });
});
