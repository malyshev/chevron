# Chevron samples

Private NestJS apps that exercise `@nestwork/chevron` via `link:../../`.

| Sample                    | What it shows                                           |
| ------------------------- | ------------------------------------------------------- |
| `000-in-memory-app/`      | Default + async named chevron gates (in-memory storage) |
| `001-env-storage-sample/` | Default gate filled from `FEATURE_*` env keys           |

```sh
pnpm dev:sample      # 000-in-memory-app
pnpm dev:sample:env  # 001-env-storage-sample
```
