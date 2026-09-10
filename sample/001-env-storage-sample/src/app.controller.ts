import { Controller, Get } from '@nestjs/common';
import { ChevronService, InjectChevron } from '@nestwork/chevron';

type FeatureState = {
    feature: string;
    active: boolean;
    value: Awaited<ReturnType<ChevronService['value']>>;
};

@Controller()
export class AppController {
    constructor(@InjectChevron() private readonly features: ChevronService) {}

    @Get('health')
    health(): { status: string } {
        return { status: 'ok' };
    }

    @Get('features/use-new-api')
    async useNewApi(): Promise<FeatureState> {
        const [active, value] = await Promise.all([
            this.features.active('useNewApi'),
            this.features.value('useNewApi'),
        ]);

        return {
            feature: 'useNewApi',
            active,
            value,
        };
    }

    @Get('features/large-avatars')
    async largeAvatars(): Promise<FeatureState> {
        const [active, value] = await Promise.all([
            this.features.active('largeAvatars'),
            this.features.value('largeAvatars'),
        ]);

        return {
            feature: 'largeAvatars',
            active,
            value,
        };
    }
}
