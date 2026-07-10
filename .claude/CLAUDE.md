# Introduction

Plumber is a no-code workflow automation tool. Users build "flows" out of triggers and actions provided by integrated "apps" (FormSG, Postman, M365 Excel, Slack, etc.). Flow executions are queued and run by background workers (some flow triggers run on the server).

This uses an npm workspaces monorepo:

- [packages/backend/](../packages/backend/) — server + workers. Scoped rules: [.claude/rules/backend.md](rules/backend.md).
- [packages/frontend/](../packages/frontend/) — React app. Scoped rules: [.claude/rules/frontend.md](rules/frontend.md).
- [packages/types/](../packages/types/) — shared `@plumber/types` (linked via `file:` deps).

## Important top-level commands

Do **not** run these yourself unless the user asks — the human runs the dev server in their own terminal.

**Human dev loop** (for context, so you understand what state the human's environment is in):

- `npm run setup` — one-time per session; brings up Postgres, Redis, DynamoDB, MinIO, etc. via Docker.
- `npm run dev` — runs backend + frontend + worker. The human re-runs / restarts this on backend changes; the frontend hot-reloads on its own.
- `npm run teardown` — tears the Docker services back down when the human is done.

**Testing:**

- `npm test` — runs the configured Vitest projects for frontend, backend unit, and backend integration tests.
- `npm run -w backend test:unit` — runs backend unit tests only.
- `npx vitest path/to/file.test.ts` — single unit test file; use `-t "<pattern>"` to filter by name.
- Backend integration tests use the `.itest.ts` suffix and require Docker/testcontainers — see [.claude/rules/backend.md](rules/backend.md).

## Conventions

- **Backend test file naming**: `*.test.ts` = unit (no DB), `*.itest.ts` = integration (real Postgres/Redis/DynamoDB via testcontainers, single-threaded). Don't mix.
- **Package manager**: only use `npm`. Never use `yarn`, `pnpm`, or other package managers.
- **Installing packages**: always pass the `-E` (exact version) flag.
- **Data parsing & validation**: prefer **Zod** whenever parsing or validating data whose shape isn't guaranteed at compile time — HTTP/API responses, form submissions, webhook and queue payloads, env vars, and any external JSON — over hand-written type guards or ad-hoc property checks.
- **Linting**: before committing, run `npm run lint:fix` (auto-fixes), then `npm run lint` and fix remaining errors. Scope to the workspace you touched: backend-only changes → `npm run -w backend lint:fix`; frontend-only → `npm run -w frontend lint:fix`; otherwise run the root command.
- **Production monitoring**: after completing a backend/frontend feature, offer to run the `setup-production-monitoring` skill to plan Datadog monitoring for it.
- **Branches & PRs**: managed via Graphite (`gt`); use the `graphite` skill.
  - **Before `gt submit`** (do both, in this order):
    1. **Fix the branch name.** If the current branch doesn't match `feat/<…>` or `chore/<…>` (e.g. an auto-generated `claude/<slug>` worktree branch), rename it first: `git branch -m <name>` (works on untracked branches) or `gt rename <name>` (if already tracked). You **MUST** ask the user for the branch name whenever it is at all possible to ask — never auto-pick a name unless asking is genuinely impossible.
    2. **Track the branch.** Ensure it is tracked onto the branch directly below it in the stack: `gt track --parent <branch-below>`. The parent is the branch immediately beneath it, or the trunk if it sits at the bottom of the stack (note: the trunk is not necessarily named `main`).

## Skills

Skills live under `.claude/skills/` at the repo root and inside individual packages (e.g. [packages/frontend/.claude/skills/](../packages/frontend/.claude/skills/), [packages/backend/.claude/skills/](../packages/backend/.claude/skills/)). Prefer repo-committed skills over locally/globally-installed ones.

There are two kinds of skills, distinguished by whether they are listed in the sibling `skills-lock.json` (root, `packages/frontend/`, `packages/backend/`):

- **Upstream skills** — listed in `skills-lock.json`, installed via `skills add <repo> --skill <name> --agent claude-code -y`. Do **not** edit their files (`SKILL.md`, etc.); upstream updates may be merged later and would clobber local changes. Per-repo overrides to their behavior go in the "Skill overrides" section below (or in the relevant `rules/*.md` for package-scoped ones).
- **Plumber-specific skills** — anything in `.claude/skills/` that is **not** in `skills-lock.json`. These are authored in-repo and are freely editable. Create one with `skills init <name>` from the directory whose `.claude/skills/` should host it (repo root for cross-cutting skills, package root for package-scoped ones).

In-repo skills: `setup-production-monitoring` — plan production monitoring for a feature (grills on failure modes, finds existing signals in the code, outputs a plan + Datadog monitor JSON in chat).

### Skill overrides

- **caveman**: default to `lite` mode (overrides the skill's own default of `full`).
