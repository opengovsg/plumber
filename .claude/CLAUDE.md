# Introduction

Plumber is a no-code workflow automation tool. Users build "flows" out of triggers and actions provided by integrated "apps" (FormSG, Postman, M365 Excel, Slack, etc.). Flow executions are queued and run by background workers (some flow triggers run on the server).

This uses a pnpm workspaces monorepo:

- [packages/backend/](../packages/backend/) — server + workers. Scoped rules: [.claude/rules/backend.md](rules/backend.md).
- [packages/frontend/](../packages/frontend/) — React app. Scoped rules: [.claude/rules/frontend.md](rules/frontend.md).
- [packages/types/](../packages/types/) — shared `@plumber/types` (linked via `workspace:*` deps).

## Language and phrasing

These rules apply to all output, including code comments and commit
messages. Follow them to maintain maximum clarity and eliminate filler:

- ONE CONCEPT PER SENTENCE: Write short, direct sentences.
  - Max 20 words for instructions/procedures.
  - Max 25 words for descriptions.
  - Do NOT use semicolons or em-dashes (—). Split them into separate sentences.

- ONE TERM PER ENTITY: Do not rotate synonyms. Pick one standard name for an object or concept and use it consistently (e.g., choose "user" and do not alternate with "client" or "customer").

- NEVER REPEAT YOURSELF: State each fact or instruction once. Do not restate it in different words later in the same passage.
  - WRONG: "Not an exhaustive list — apply this to any case, not just these."
  - RIGHT: "Not an exhaustive list."

- ACTIVE VERBS ONLY: Use direct action verbs instead of normalized nouns.
  - WRONG: "Perform an analysis of the logs."
  - RIGHT: "Analyze the logs."

- NO HEDGING OR FILLER: State facts directly.
  - WRONG: "It is important to note that this configuration may potentially help improve performance."
  - RIGHT: "This configuration improves performance."

- NO MARKETING SLOP OR PHRASAL VERBS
  - Ban unprovable claims: "seamless", "robust", "powerful", "cutting-edge", "game-changing". Explain mechanics instead.
  - Ban soft conversational verbs: "spin up", "dive into", "reach out", "slot into". Use precise verbs ("create", "examine", "contact", "integrate").

## Important top-level commands

Do **not** run these yourself unless the user asks — the human runs the dev server in their own terminal.

**Human dev loop** (for context, so you understand what state the human's environment is in):

- `pnpm run setup` — one-time per session; brings up Postgres, Redis, DynamoDB, MinIO, etc. via Docker.
- `pnpm run dev` — runs backend + frontend + worker. The human re-runs / restarts this on backend changes; the frontend hot-reloads on its own.
- `pnpm run teardown` — tears the Docker services back down when the human is done.

**Testing:**

- `pnpm test` — runs frontend tests, backend unit tests, and backend integration tests as separate Turborepo tasks (`turbo run test test:unit test:integration`).
- `pnpm --filter backend run test:unit` — runs backend unit tests only.
- `pnpm exec vitest path/to/file.test.ts` — single unit test file; use `-t "<pattern>"` to filter by name.
- Backend integration tests use the `.itest.ts` suffix and require Docker/testcontainers — see [.claude/rules/backend.md](rules/backend.md).

## Conventions

- **Backend test file naming**: `*.test.ts` = unit (no DB), `*.itest.ts` = integration (real Postgres/Redis/DynamoDB via testcontainers, single-threaded). Don't mix.
- **Package manager**: only use `pnpm`. Never use `npm`, `yarn`, or other package managers.
- **Installing packages**: always pass the `-E` (exact version) flag. Dependency versions live in the `catalog:` section of [pnpm-workspace.yaml](../pnpm-workspace.yaml); every `package.json` references them via `"catalog:"` instead of a version string.
- **Data parsing & validation**: prefer **Zod** whenever parsing or validating data whose shape isn't guaranteed at compile time — HTTP/API responses, form submissions, webhook and queue payloads, env vars, and any external JSON — over hand-written type guards or ad-hoc property checks.
- **Linting**: before committing, run `pnpm run lint:fix` (auto-fixes), then `pnpm run lint` and `pnpm run typecheck`, fixing remaining errors. Scope to the workspace you touched: backend-only changes → `pnpm --filter backend run lint:fix`; frontend-only → `pnpm --filter frontend run lint:fix`; otherwise run the root commands.
- **Production monitoring**: after completing a backend/frontend feature, offer to run the `setup-production-monitoring` skill to plan Datadog monitoring for it.
- **Commit messages**: keep the full message under 300 characters.
- **Branches & PRs**: managed via Graphite (`gt`); use the `graphite` skill.
  - **Branch name prefixes**: `feat/<…>` for features, `fix/<…>` for bugfixes, `chore/<…>` for everything else.
  - **Before `gt submit`** (do both, in this order):
    1. **Fix the branch name.** If the current branch doesn't use one of those prefixes (e.g. an auto-generated `claude/<slug>` worktree branch), rename it first: `git branch -m <name>` (works on untracked branches) or `gt rename <name>` (if already tracked). You **MUST** ask the user for the branch name whenever it is at all possible to ask — never auto-pick a name unless asking is genuinely impossible.
    2. **Track the branch.** Ensure it is tracked onto the branch directly below it in the stack: `gt track --parent <branch-below>`. The parent is the branch immediately beneath it, or the trunk if it sits at the bottom of the stack (note: the trunk is not necessarily named `main`).

## Code comments

Comments state WHY, never WHAT.

- DELETE IF SELF-EXPLANATORY: If a reader who can read the code would not be confused without the comment, delete the entire block.
- ONE WHY PER COMMENT: State the single non-obvious reason the code exists or behaves this way. Do not also trace the code's internal branching or filtering logic in prose. That is still WHAT, even when framed as justification.
- NO PLAN REFERENCES: Do not mention plan phases, task names, or step numbers from a plan in a comment.
- OMIT OBVIOUS WHY: Within a comment, cut any reason that follows trivially from the type signature, the function name, or an already-established fact. This trims one reason, not the whole comment, unless no non-obvious reason remains.
- SHORT AND FLAT: One or two sentences, not a multi-paragraph doc comment. Use "IMPORTANT:" to flag a genuine gotcha instead of weaving it into prose.

Example:

WRONG (traces the mechanism):
    /**
     * Whether execution has reached this MRF step. Normally the previous step
     * ran, but it may sit inside an if-then V2 block that a FALSE condition
     * skipped, so absence of an execution step proves nothing on its own...
     */

RIGHT (states only the motivating problem):
    /**
     * Checks whether execution reached this sub-trigger.
     *
     * Handles MRF submissions arriving before earlier steps finish running.
     */

## Skills

Skills live under `.claude/skills/` at the repo root and inside individual packages (e.g. [packages/frontend/.claude/skills/](../packages/frontend/.claude/skills/), [packages/backend/.claude/skills/](../packages/backend/.claude/skills/)). Prefer repo-committed skills over locally/globally-installed ones.

There are two kinds of skills, distinguished by whether they are listed in the sibling `skills-lock.json` (root, `packages/frontend/`, `packages/backend/`):

- **Upstream skills** — listed in `skills-lock.json`, installed via `skills add <repo> --skill <name> --agent claude-code -y`. Do **not** edit their files (`SKILL.md`, etc.); upstream updates may be merged later and would clobber local changes. Per-repo overrides to their behavior go in the "Skill overrides" section below (or in the relevant `rules/*.md` for package-scoped ones).
- **Plumber-specific skills** — anything in `.claude/skills/` that is **not** in `skills-lock.json`. These are authored in-repo and are freely editable. Create one with `skills init <name>` from the directory whose `.claude/skills/` should host it (repo root for cross-cutting skills, package root for package-scoped ones).

In-repo skills: `setup-production-monitoring` — plan production monitoring for a feature (grills on failure modes, finds existing signals in the code, outputs a plan + Datadog monitor JSON in chat).

### Skill overrides

- **caveman**: default to `lite` mode (overrides the skill's own default of `full`).
