# Changesets

This folder holds pending version bumps for `@nestwork/chevron` (root package).

```sh
pnpm changeset          # describe a change; writes a markdown file here
pnpm version-packages   # apply version bumps and changelogs
pnpm release            # build and publish (requires npm auth)
```

Only the root library is versioned. Private samples under `sample/` are excluded automatically.
