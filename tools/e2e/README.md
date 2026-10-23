# Plumber E2E

This workspace imports `opengovsg/plumber-e2e` at `8b3332201a53406f2aa6375f5592754f12fd1779`.
All 16 test files retain that revision's assertions, including staging/UAT support and the AI Builder timeout update.
Files follow the main repository's Oxlint and Oxfmt configuration.
The environment profiles load private fixture IDs from `E2E_FIXTURE_MANIFEST`. Helpers, authentication defaults, and Playwright settings remain unchanged.
The login script imports Chromium from the declared `@playwright/test` dependency for pnpm compatibility.

## Commands

Install workspace dependencies from the repository root using its Node version and `pnpm install --frozen-lockfile`.
For E2E execution, use Node 26.12.1 from this directory's `.nvmrc`.
This matches the original suite's Gmail OAuth compatibility pin.

Run these commands from the repository root:

```sh
pnpm login:e2e
pnpm test:e2e
pnpm test:e2e:ui
pnpm --filter @plumber/e2e run test:config
```

Root `pnpm test` excludes live E2E execution.
Root lint and typecheck include this workspace.
The workspace uses the root Oxlint and Oxfmt versions and configuration.
Root lint, format, and typecheck tasks include this workspace.

## Configuration

Use the existing E2E `.env` configuration in `tools/e2e/.env`.
The required settings remain `GMAIL_CREDENTIALS`, `GMAIL_TOKEN`, and `GATHERSG_API_KEY`.
Copy the existing `AUTH_FILE_ENCRYPTION_SECRET` when reusing encrypted session state.
Its original `'secret'` fallback remains available.

`E2E_ENV` selects `staging` by default or `uat` fixtures from the JSON setting `E2E_FIXTURE_MANIFEST`.
Create an Actions secret named `E2E_FIXTURE_MANIFEST` in the repository or each selected GitHub environment.
The populated manifest lives in the trusted Notion consolidation document. Do not commit it.
`fixture-manifest.example.json` documents the shape using synthetic IDs.
Each profile contains all 13 `pipes` keys and four `forms` keys from that example.
The selected profile is required. Missing, malformed, or incomplete manifests stop execution.
Environment secrets can contain only their matching profile. The legacy production option requires the staging profile.
For local execution, add the JSON as one single-quoted line in the ignored `tools/e2e/.env`:

```dotenv
E2E_FIXTURE_MANIFEST='<compact JSON from the trusted Notion document>'
```

Keep local copies private. Configuration tests use synthetic fixtures and require no secrets.
The UAT profile targets `https://uat.plumber.gov.sg` and supplies 13 pipe IDs and four form IDs.
Action webhook URLs and editor/execution paths use the selected profile.

For local UAT execution, set `E2E_ENV=uat` in `tools/e2e/.env`, then run login and tests.
Login and tests use `cookie-auth-state-uat`. Staging uses `cookie-auth-state-staging`.
Rerun login after switching environments rather than reusing the previous environment's session.

The profiles share the existing webhook observation service by default.
Set `WEBHOOK_TESTER_HOSTNAME` only when overriding it. In CI, use the matching GitHub environment variable.
Existing mailbox, sender, connection-name, and form-ID overrides remain available.
UAT rejects a `BASE_URL` override pointing outside `uat.plumber.gov.sg`.

The upstream `production` option retains staging fixtures and the staging URL unless `BASE_URL` is overridden.
It does not provide production-specific fixtures. This migration preserves that upstream behavior.
Configuration tests run without live credentials or network requests.

For local execution, follow the existing setup instructions in `plumber-e2e/README.md`.
Use compatible fixtures and real third-party credentials.
The application's sample environment does not provide those credentials.
For an existing localhost session, run `pnpm --filter @plumber/e2e run login:local -- <cookie>`.

## CI and rollout

The `Plumber E2E` workflow supports manual execution and the `plumber-staging-deployed` repository dispatch event.
It uses `plumber-runners` and selects the GitHub environment matching the manual input: `staging`, `uat`, or `production`.
Deployment dispatch events always select `staging`.
`E2E_ENV` uses the same selection as the GitHub environment, so login, fixtures, and secrets stay aligned.
The workflow shares one concurrency group across environments because the profiles share a mailbox and external services.
The original repository can still run concurrently. Avoid overlapping manual runs during validation.
E2E notifications use `secrets.SLACK_E2E_CHANNEL_ID`. Configure it as a repository Actions secret or in each selected GitHub environment.
Invite the Slack bot to that channel. Deployment notifications continue using their existing channel setting.
Fixture identifiers are masked individually before login and tests. The manifest is available only to steps that require it.
Gmail, GatherSG, and session-encryption secrets are limited to login and test steps.
Checkout does not persist its GitHub token. The workflow removes session files even when login or tests fail.
Dependency installation uses the shared setup action and root Node version. A separate step selects the E2E Node version before execution.
Public logs still require care. Masking does not sanitize reports or every transformed representation of an ID.
Previously committed IDs remain in public Git history. Rotate exposed webhook addresses to invalidate those copies.
Report uploads are disabled because this repository is public.
Playwright still generates reports locally.

1. Grant `plumber` access to `plumber-runners` and the staging integrations' network allowlists.
2. Add the Actions secret `E2E_FIXTURE_MANIFEST`. Copy `GMAIL_CREDENTIALS`, `GMAIL_TOKEN`, `GATHERSG_API_KEY`, and `AUTH_FILE_ENCRYPTION_SECRET` into each GitHub environment being tested.
3. Ensure `NPM_TASKFORCESH_TOKEN` and `SLACK_BOT_TOKEN` are available. Set the Actions secret `SLACK_E2E_CHANNEL_ID` to the E2E channel ID.
4. Review each selected environment's branch restrictions, required reviewers, and runner IP access to its target application.
5. Merge this change into `develop-v2`. Repository dispatch requires the workflow on the default branch.
6. Run the workflow manually against staging and UAT when their databases and fixtures are ready. Confirm results and Slack notifications.
7. Grant the infrastructure dispatch token Contents read/write access to `opengovsg/plumber`.
8. Merge the companion `plumber-infra` change. Deploy staging through its merged-PR `/deploy staging` workflow.
9. Verify a successful staging CodeDeploy deployment triggers this workflow.
10. Archive `plumber-e2e` only after the migrated workflow completes successfully through the deployment trigger.

The infrastructure event follows CodeDeploy SUCCESS, since the application deploy workflow does not wait for service stability.
Its payload identifies the deployment, but does not include the deployed Git SHA.
Dispatch runs use the default branch's tests against the current staging application.

For rollback, restore the infrastructure dispatch destination to `plumber-e2e` through its normal PR deployment process.
Keep the original dispatch token access and repository available until validation finishes.

## Dependency policy

Use the repository's shared pnpm lockfile, catalog, and overrides. Regenerate dependency resolution from the repository root.
Do not copy dependency records from a standalone installation.

- `typescript`, `ts-node`, `dotenv`, and `zod` use `catalog:` to follow the main repository's selected versions.
- Oxlint and Oxfmt come from root tooling. E2E does not maintain separate linter or formatter dependencies.
- The workspace's `@types/node` override controls Node typings across packages.
- Keep Playwright, Gmail tooling, Cryptr, and Day.js pinned while only E2E needs these versions.
- Move a dependency into the shared catalog when another workspace needs the same package and compatible version.
- Apply workspace overrides to transitive dependencies. Document and test any justified exception instead of bypassing an override.

Run `pnpm install --lockfile-only --ignore-scripts --prefer-frozen-lockfile` from the repository root after dependency changes.
Review the resulting lockfile, then run E2E lint, format, typecheck, configuration tests, and test discovery.
Playwright upgrades also require browser installation and a live E2E run.

`ts-node` is pinned to `10.9.2` in the shared catalog.
E2E, backend, and backend-archive follow that pin. Validate all three consumers when updating it.

E2E retains its separate Node pin for Gmail compatibility. Align it with the root `.nvmrc` only after validating login and live tests.
