export const REDIS_LOGICAL_DATABASES = 256
export const REDIS_DBS_PER_WORKER = 5
export const INTEGRATION_PROJECTS = 2
// IMPORTANT: redlock silently falls back to DB 0 for any DB above 15, so each
// worker's app-data DB must sit in 0-15. Other DBs start after that range.
export const REDLOCK_DATABASES = 16
export const MAX_WORKER_SLOTS = REDLOCK_DATABASES / INTEGRATION_PROJECTS
