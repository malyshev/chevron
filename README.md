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
pnpm dev:sample:env # lib watch + sample/001-env-storage-sample
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

See `sample/000-in-memory-app` for default + async named gates, and `sample/001-env-storage-sample` for `{ driver: 'env' }`.

## Named gates and injection scope

- **Default chevron** (no `name`) is global — `@InjectChevron()` works in any module without re-importing `ChevronModule`.
- **Named chevrons** default to module scope — inject `@InjectChevron('billing')` only in modules that import `ChevronModule.forRoot({ name: 'billing' })`. The feature module must **export** `ChevronModule` for importers.
- **App-wide named chevron** — set `isGlobal: true` on `forRoot` / `forRootAsync`.

## Storage

Default storage is in-memory (`{ driver: 'memory' }`). Class-token and `useClass` registrations use Nest `ModuleRef.create()` for constructor DI.

Env storage (`{ driver: 'env', prefix: 'FEATURE_' }`) scans matching keys once at construct (`FEATURE_USE_NEW_API` → `useNewApi`) and keeps them in the same in-memory map. Put those variables on `process.env` before the gate is created (`node --env-file=.env` or `process.loadEnvFile()`). Restart the process to pick up env changes. A stored value wins over a `features` map entry and over the first `define()` of that name; a later `define()` of the same name clears storage like a redefine.

Coercion of env strings: `true` / `1` / `yes` / `on` → `true`; `false` / `0` / `no` / `off` / `''` → `false`; an integer or decimal → `number`; anything else stays a string.

```typescript
ChevronModule.forRoot({
    storage: { driver: 'env', prefix: 'FEATURE_' },
});
```

Storage options are validated synchronously when the module is built, not on first use — an invalid `env` prefix, or two env keys that collapse to the same camelCase feature name (e.g. `FEATURE_LANG` and `FEATURE_Lang`), throws during Nest's DI bootstrap and fails app startup.

## Concurrency

`ChevronService` caches each feature's resolved value and de-duplicates concurrent lookups, so a resolver runs at most once even under parallel `active()`/`value()` calls for the same feature. `activate()`, `deactivate()`, `forget()`, `define()`, and `purge()` invalidate that cache immediately; a lookup already in flight when one of these runs never re-caches a stale result, even if its own storage write physically lands afterward. Safe to call from concurrent requests without external locking.

## Release

```sh
pnpm changeset
pnpm version-packages
pnpm release
```

## Code style

Prettier, ESLint (type-checked flat config), Husky + lint-staged, Jest.
