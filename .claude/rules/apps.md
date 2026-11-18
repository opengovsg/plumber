---
paths:
  - 'packages/backend/src/apps/**/*'
  - 'packages/backend-analytics/data/action-catalog.csv'
---

# Apps, triggers and actions

Every integration lives under [packages/backend/src/apps/<key>/](../../packages/backend/src/apps/) and default-exports an `IApp` (`@plumber/types`) describing metadata, `triggers`, `actions`, optional `auth`, and optional `queue`. New apps must also be registered in [packages/backend/src/apps/index.ts](../../packages/backend/src/apps/index.ts). Triggers/actions are individual modules combined via an `index.ts` array (see e.g. [packages/backend/src/apps/postman/actions/index.ts](../../packages/backend/src/apps/postman/actions/index.ts)). Static assets in each app's `assets/` are served at `/apps/<key>/assets/...` via [packages/backend/src/helpers/app-assets-handler.ts](../../packages/backend/src/helpers/app-assets-handler.ts).

IMPORTANT: Analytics labels app-actions from [packages/backend-analytics/data/action-catalog.csv](../../packages/backend-analytics/data/action-catalog.csv). After adding, renaming or removing a trigger or action, regenerate it and commit the file:

```bash
pnpm --filter backend exec vitest run src/apps/__tests__/index.test.ts -u
```

The command keeps the hand-entered columns. Then fill the new row's `resource_parameter` with the argument key that names the resource the step points at (a table, file or channel, e.g. `tableId`), or `none`. Leave `launched_at` blank for the product team to fill. If you change an existing row's `resource_parameter`, say in the PR that `flow_step` needs a `--full` export after deploy.
