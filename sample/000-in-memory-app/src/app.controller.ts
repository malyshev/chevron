import { Controller, Get, Post, Query } from '@nestjs/common';
import { ChevronService, InjectChevron } from '@nestwork/chevron';

type FeatureState = {
    feature: string;
    active: boolean;
    value: Awaited<ReturnType<ChevronService['value']>>;
};

type FeatureToggleState = {
    feature: string;
    active: boolean;
};

@Controller()
export class AppController {
    constructor(
        @InjectChevron() private readonly features: ChevronService,
        @InjectChevron('async') private readonly asyncFeatures: ChevronService,
    ) {}

    @Get('health')
    health(): { status: string } {
        return { status: 'ok' };
    }

    @Get('features/demo')
    async demoFeature(): Promise<FeatureState> {
        const [active, value] = await Promise.all([
            this.features.active('demo-feature'),
            this.features.value('demo-feature'),
        ]);

        return {
            feature: 'demo-feature',
            active,
            value,
        };
    }

    @Get('features/zero-is-active')
    async zeroIsActive(): Promise<FeatureState> {
        const [active, value] = await Promise.all([
            this.features.active('zero-is-active'),
            this.features.value('zero-is-active'),
        ]);

        return {
            feature: 'zero-is-active',
            active,
            value,
        };
    }

    @Get('features/computed')
    async computedFeature(): Promise<FeatureState> {
        const [active, value] = await Promise.all([
            this.features.active('computed-feature'),
            this.features.value('computed-feature'),
        ]);

        return {
            feature: 'computed-feature',
            active,
            value,
        };
    }

    @Get('features/async-env')
    async asyncEnvFeature(): Promise<FeatureState> {
        const [active, value] = await Promise.all([
            this.asyncFeatures.active('async-env-feature'),
            this.asyncFeatures.value('async-env-feature'),
        ]);

        return {
            feature: 'async-env-feature',
            active,
            value,
        };
    }

    @Post('features/toggle')
    async toggleDemoFeature(@Query('active') active = 'true'): Promise<FeatureToggleState> {
        if (active === 'false') {
            await this.features.deactivate('demo-feature');
        } else {
            await this.features.activate('demo-feature');
        }

        return {
            feature: 'demo-feature',
            active: await this.features.active('demo-feature'),
        };
    }

    @Post('features/forget')
    async forgetDemoFeature(): Promise<FeatureToggleState> {
        await this.features.forget('demo-feature');

        return {
            feature: 'demo-feature',
            active: await this.features.active('demo-feature'),
        };
    }
}
