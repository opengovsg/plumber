![](./plumber.svg)

# Plumber

_Automate your pipelines and streamline your workflows._

Plumber is a no-code solution that helps public officers automate their repetitive tasks and eliminate human error, so they can focus on their more important work. It supports a growing list of both government and commercial apps and services.

## Local dev

1. Install Docker and make sure it's running
2. Install code dependencies by running `pnpm install`
3. Install global dependencies:
   1. [Codegraph](https://github.com/colbymchenry/codegraph)
4. Install the [1Password desktop app](https://1password.com/downloads) and sign in
5. In 1Password, turn on Settings > Developer > Integrate with other apps. Turn on Touch ID (or Windows Hello) under Settings > Security so you can answer the prompt
6. Copy `op-dev.example.json` to `op-dev.json`, then fill in your account name and your three environment ids. Copy an id from Developer > View Environments > View environment > Manage environment > Copy environment ID
   - `inheritedEnvironments` is optional. List environment ids there to load common team-level env vars before your own. Your own environment's variables override theirs
7. Setup services `pnpm run setup`
8. Run DB migrations `pnpm run migrate` (only for first time setup)
9. Start the server `pnpm run dev`

`pnpm run setup` and `pnpm run dev` each fetch their secrets from 1Password, so both prompt once and both need the app running. There is no `.env` file.

### On Windows?

Plumber doesn't officially support Windows as a dev environment, but some contributors have managed to get it working.

See [WINDOWS_DEV.md](./docs/WINDOWS_DEV.md) for their windows-specific setup steps and known issues.

## AI Builder observability

AI Builder exports traces to Rome through the existing Langfuse processors and Cloudflare Access headers.
Set both backend variables to export the same traces to PostHog as well:

```text
POSTHOG_PROJECT_TOKEN=<project token for the frontend's PostHog project>
POSTHOG_HOST=https://us.i.posthog.com
```

Use `https://eu.i.posthog.com` for an EU project.
Use an ingestion host that accepts `/i/v0/ai/otel` if you configure a proxy.
Leaving either variable empty disables PostHog export.
Rome still receives traces regardless of whether PostHog export is enabled.

ECS injects these settings from SSM Parameter Store through `ecs/env.json`.
Before deploying, create `plumber-posthog-project-token` and `plumber-posthog-host` in each deployment account.
These shared parameter names apply to every environment.
Store the project token as a `SecureString` parameter.
The host can use a `String` parameter.
Both parameters must exist for ECS to start the task, even when PostHog export is disabled in application configuration.
Ensure the task execution role can read both parameters and decrypt the token's KMS key.

PostHog receives AI Builder traces, including prompts, responses, and tool calls.
PAIR action traces continue to export only to Rome.
PostHog identifies users by their Plumber user ID and groups chat turns by `chatId`.
Both destinations retain the OpenTelemetry trace ID.
PostHog receives cache-read token counts when PAIR reports `prompt_tokens_details.cached_tokens`.
Input token totals include cache reads. PostHog uses the separate cache-read count to calculate the breakdown.
Missing cache usage remains unknown. The current OpenAI-compatible SDK does not expose cache-write counts.
The server flushes both destinations after draining HTTP requests during graceful shutdown.

In staging, send a chat that calls a tool and compare both trace timelines.
Confirm matching trace IDs, tool spans, token usage, and PostHog user attribution.
Exports use the transport's JSON serializer to split batches below 3.5 MB, leaving room below PostHog's 4 MB limit.
Splitting batches preserves span content, IDs, timestamps, and trace relationships.
If a single span exceeds 3.5 MB, PostHog receives its IDs, timing, and key metadata with content-omission notices.
The span includes `posthog.content_omitted` and `posthog.original_payload_bytes` properties.
Rome retains the original span content.
See [PostHog's OpenTelemetry documentation](https://posthog.com/docs/ai-observability/installation/opentelemetry).

## Acknowledgements

Plumber is a fork of the open source project [Automatisch](https://github.com/automatisch/automatisch). We would like to thank the team for their contributions to the open source community. Please refer to the license files [[1](./LICENSE.md),[2](./LICENSE.agpl)] for more information.
