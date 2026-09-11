![](./plumber.svg)

# Plumber

_Automate your pipelines and streamline your workflows._

Plumber is a no-code solution that helps public officers automate their repetitive tasks and eliminate human error, so they can focus on their more important work. It supports a growing list of both government and commercial apps and services.

## Local dev

1. Install Docker and make sure it's running
2. Install code dependencies by running `npm i`
3. Install global dependencies:
   1. [Codegraph](https://github.com/colbymchenry/codegraph)
4. Install the [1Password desktop app](https://1password.com/downloads) and sign in
5. In 1Password, turn on Settings > Developer > Integrate with other apps. Turn on Touch ID (or Windows Hello) under Settings > Security so you can answer the prompt
6. Copy `op-dev.example.json` to `op-dev.json`, then fill in your account name and your three environment ids. Copy an id from Developer > View Environments > View environment > Manage environment > Copy environment ID
   - `inheritedEnvironments` is optional. List environment ids there to load common team-level env vars before your own. Your own environment's variables override theirs
7. Setup services `npm run setup`
8. Run `npm run migrate` (only for first time setup). When prompted (see [Running DB migrations](#running-db-migrations)), choose "Local dev"
9. Start the server `npm run dev`

`npm run setup` and `npm run dev` each fetch their secrets from 1Password, so both prompt once and both need the app running. There is no `.env` file.

### Running DB migrations

The `db` scripts in `backend` handle migration; run these with `npm run -w backend db:*`. In general:

1. `npm run -w backend db:list` to list pending migrations
2. `npm run -w backend db:migrate` to run the migrations themselves.

Every `npm run -w backend db:*` script (`db:migrate`, `db:rollback`, `db:migration:create`, `db:list`) can write to a real Postgres database, so it runs through `scripts/with-op-migration.mjs` to load the appropriate env vars from 1Password. These 1Password environments should contain only the vars [`db.ts`](./packages/backend/src/config/app/db.ts) reads (e.g. `POSTGRES_HOST`, `POSTGRES_USERNAME`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`).

DB migrations on local dev doesn't load from 1Password. It relies on `.env-example`'s defaults.

### On Windows?

Plumber doesn't officially support Windows as a dev environment, but some contributors have managed to get it working.

See [WINDOWS_DEV.md](./docs/WINDOWS_DEV.md) for their windows-specific setup steps and known issues.

## Acknowledgements

Plumber is a fork of the open source project [Automatisch](https://github.com/automatisch/automatisch). We would like to thank the team for their contributions to the open source community. Please refer to the license files [[1](./LICENSE.md),[2](./LICENSE.agpl)] for more information.
