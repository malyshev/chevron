import { ChevronService } from '@nestwork/chevron';
import { AppController } from './app.controller';

describe('AppController', () => {
    const createController = (
        features: Partial<ChevronService> = {},
        asyncFeatures: Partial<ChevronService> = {},
    ): AppController => {
        const service = {
            active: jest.fn(),
            value: jest.fn(),
            activate: jest.fn(),
            deactivate: jest.fn(),
            forget: jest.fn(),
            ...features,
        } as unknown as ChevronService;

        const asyncService = {
            active: jest.fn(),
            value: jest.fn(),
            activate: jest.fn(),
            deactivate: jest.fn(),
            forget: jest.fn(),
            ...asyncFeatures,
        } as unknown as ChevronService;

        return new AppController(service, asyncService);
    };

    it('health returns ok', () => {
        const controller = createController();

        expect(controller.health()).toEqual({ status: 'ok' });
    });

    it('demoFeature returns active state and value', async () => {
        const controller = createController({
            active: jest.fn().mockResolvedValue(true),
            value: jest.fn().mockResolvedValue(true),
        });

        await expect(controller.demoFeature()).resolves.toEqual({
            feature: 'demo-feature',
            active: true,
            value: true,
        });
    });

    it('zeroIsActive treats zero as active', async () => {
        const controller = createController({
            active: jest.fn().mockResolvedValue(true),
            value: jest.fn().mockResolvedValue(0),
        });

        await expect(controller.zeroIsActive()).resolves.toEqual({
            feature: 'zero-is-active',
            active: true,
            value: 0,
        });
    });

    it('toggleDemoFeature activates by default', async () => {
        const active = jest.fn().mockResolvedValue(true);
        const activate = jest.fn().mockResolvedValue(undefined);
        const controller = createController({ active, activate });

        await expect(controller.toggleDemoFeature()).resolves.toEqual({
            feature: 'demo-feature',
            active: true,
        });
        expect(activate).toHaveBeenCalledWith('demo-feature');
    });

    it('toggleDemoFeature deactivates when active=false', async () => {
        const active = jest.fn().mockResolvedValue(false);
        const deactivate = jest.fn().mockResolvedValue(undefined);
        const controller = createController({ active, deactivate });

        await expect(controller.toggleDemoFeature('false')).resolves.toEqual({
            feature: 'demo-feature',
            active: false,
        });
        expect(deactivate).toHaveBeenCalledWith('demo-feature');
    });

    it('forgetDemoFeature clears stored override', async () => {
        const active = jest.fn().mockResolvedValue(true);
        const forget = jest.fn().mockResolvedValue(undefined);
        const controller = createController({ active, forget });

        await expect(controller.forgetDemoFeature()).resolves.toEqual({
            feature: 'demo-feature',
            active: true,
        });
        expect(forget).toHaveBeenCalledWith('demo-feature');
    });

    it('computedFeature returns active state and value', async () => {
        const controller = createController({
            active: jest.fn().mockResolvedValue(true),
            value: jest.fn().mockResolvedValue(true),
        });

        await expect(controller.computedFeature()).resolves.toEqual({
            feature: 'computed-feature',
            active: true,
            value: true,
        });
    });

    it('asyncEnvFeature reads from the async gate', async () => {
        const controller = createController(
            {},
            {
                active: jest.fn().mockResolvedValue(true),
                value: jest.fn().mockResolvedValue(true),
            },
        );

        await expect(controller.asyncEnvFeature()).resolves.toEqual({
            feature: 'async-env-feature',
            active: true,
            value: true,
        });
    });
});
