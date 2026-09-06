# @nestwork/chevron

Feature flags for NestJS applications.

## Layout

| Path            | Purpose                                               |
| --------------- | ----------------------------------------------------- |
| `src/`          | Library source (compiled to `dist/`)                  |
| `sample/`       | Private integration apps (`link:../../`)              |
| `tools/eslint/` | Shared ESLint flat config (repo-local, not published) |

## Prerequisites

- Node.js 20+; **22 recommended** — `.nvmrc` / `.node-version`
- pnpm 11.25.0 — `corepack enable`

## Commands

```sh
pnpm install
pnpm build          # src → dist/
pnpm build:all      # lib + samples
pnpm test           # lib unit tests
pnpm test:all       # lib + sample tests
pnpm lint
pnpm check-types
pnpm dev:sample     # lib watch + sample/000-in-memory-app
```

## Quick start

```typescript
import { Injectable, Module } from '@nestjs/common';
import { ChevronModule, InjectChevron, ChevronService } from '@nestwork/chevron';

@Module({
    imports: [
        ChevronModule.forRoot({
            features: {
                'new-checkout': true,
            },
        }),
    ],
})
export class AppModule {}

@Injectable()
export class CheckoutService {
    constructor(@InjectChevron() private readonly features: ChevronService) {}

    async run(): Promise<void> {
        if (await this.features.active('new-checkout')) {
            // ...
        }
    }
}
```

See `sample/000-in-memory-app` for default + async named gates.

## Named gates and injection scope

- **Default chevron** (no `name`) is global — `@InjectChevron()` works in any module without re-importing `ChevronModule`.
- **Named chevrons** default to module scope — inject `@InjectChevron('billing')` only in modules that import `ChevronModule.forRoot({ name: 'billing' })`. The feature module must **export** `ChevronModule` for importers.
- **App-wide named chevron** — set `isGlobal: true` on `forRoot` / `forRootAsync`.

## Storage

Default storage is in-memory (`{ driver: 'memory' }`). Class-token and `useClass` registrations use Nest `ModuleRef.create()` for constructor DI.

## Release

```sh
pnpm changeset
pnpm version-packages
pnpm release
```

## Code style

Prettier, ESLint (type-checked flat config), Husky + lint-staged, Jest.
