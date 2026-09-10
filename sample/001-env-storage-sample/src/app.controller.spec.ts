import { ChevronService } from '@nestwork/chevron';
import { AppController } from './app.controller';

describe('AppController', () => {
    const createController = (features: Partial<ChevronService> = {}): AppController => {
        const service = {
            active: jest.fn(),
            value: jest.fn(),
            ...features,
        } as unknown as ChevronService;

        return new AppController(service);
    };

    it('health returns ok', () => {
        const controller = createController();

        expect(controller.health()).toEqual({ status: 'ok' });
    });

    it('useNewApi returns active state and value', async () => {
        const controller = createController({
            active: jest.fn().mockResolvedValue(true),
            value: jest.fn().mockResolvedValue(true),
        });

        await expect(controller.useNewApi()).resolves.toEqual({
            feature: 'useNewApi',
            active: true,
            value: true,
        });
    });

    it('largeAvatars returns active state and value', async () => {
        const controller = createController({
            active: jest.fn().mockResolvedValue(false),
            value: jest.fn().mockResolvedValue(false),
        });

        await expect(controller.largeAvatars()).resolves.toEqual({
            feature: 'largeAvatars',
            active: false,
            value: false,
        });
    });
});
