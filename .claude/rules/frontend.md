---
paths:
  - 'packages/frontend/**/*'
---

# Frontend

React + Vite + Apollo client + Chakra UI / OGP design system. Path alias `@/*` → `packages/frontend/src/*`.

## Important commands

Run from [packages/frontend/](../../packages/frontend/) or via `npm run -w frontend …`.

**Testing:**

- `npm test` — runs the frontend vitest suite.

**Regenerate Chakra theme typings:**

- `npm run gen:theme-typings` — re-runs the Chakra CLI against [packages/frontend/src/theme/index.ts](../../packages/frontend/src/theme/index.ts). Also runs automatically via `postinstall`; re-run by hand after editing the theme tokens.

## GraphQL

Schema lives in the backend at [packages/backend/src/graphql/schema.graphql](../../packages/backend/src/graphql/schema.graphql) plus colocated `*.graphql` files. Resolvers are split into [packages/backend/src/graphql/queries/](../../packages/backend/src/graphql/queries/) and [packages/backend/src/graphql/mutations/](../../packages/backend/src/graphql/mutations/), each a single named-export function wired up in [packages/backend/src/graphql/resolvers.ts](../../packages/backend/src/graphql/resolvers.ts).

Codegen config: [gql-codegen.ts](../../gql-codegen.ts). It writes:

- [packages/backend/src/graphql/**generated**/](../../packages/backend/src/graphql/__generated__/) — server resolver types. Default context is `AuthenticatedGraphQLContext`, overridden per-field (e.g. `Query.getCurrentUser` uses `UnauthenticatedGraphQLContext`).
- [packages/frontend/src/graphql/**generated**/](../../packages/frontend/src/graphql/__generated__/) — client preset, immutable types.

Run `npm run gqlc` (root) after editing `.graphql` files or any `*.gql-to-typescript.ts` mapper. Codegen runs automatically via `postinstall`.

## App entry & providers

[packages/frontend/src/index.tsx](../../packages/frontend/src/index.tsx) wires the provider stack: `ThemeProvider` → `ApolloProvider` → `AuthenticationProvider` → `TimezoneProvider` → `LaunchDarklyProvider` → `RouterProvider`.

- **Routing**: [packages/frontend/src/routes.tsx](../../packages/frontend/src/routes.tsx) (react-router via `createRoutesFromElements`). Pages live in [packages/frontend/src/pages/](../../packages/frontend/src/pages/) per feature (e.g. the flow editor at [packages/frontend/src/pages/Editor/](../../packages/frontend/src/pages/Editor/)).
- **Apollo**: configured in [packages/frontend/src/components/ApolloProvider/](../../packages/frontend/src/components/ApolloProvider/); GraphQL operations live in [packages/frontend/src/graphql/](../../packages/frontend/src/graphql/).
- **Auth**: [packages/frontend/src/contexts/Authentication](../../packages/frontend/src/contexts/Authentication).
- **Feature flags**: LaunchDarkly via [packages/frontend/src/contexts/LaunchDarkly](../../packages/frontend/src/contexts/LaunchDarkly).
- **Telemetry**: Datadog RUM is initialised in [packages/frontend/src/index.tsx](../../packages/frontend/src/index.tsx) for `prod` / `staging` only.
