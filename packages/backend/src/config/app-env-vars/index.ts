/**
 * == What ==
 * This folder is for files that store app-specific env vars.
 *
 * == Why ==
 * We want all env vars to be referenced during initialization, so that we can
 * automatically trigger a rollback if we forgot to configure some env vars.
 *
 * It's easier to ensure this if we collect all apps' env vars into a central
 * location, instead of instead of allowing apps to reference env vars at any
 * code anywhere.
 *
 * This this because a central location allows us to
 * - Easily check what are all the env vars we need to configure
 * - Set up lint rules (e.g. no `process.env` outside of `app-env-vars` directory)
 *
 * == How ==
 * This file is imported by both worker.ts and server.ts.
 *
 * To add new env vars, create the appropriate <app>.ts file in this and
 * import it in this index file.
 */

import './m365'
