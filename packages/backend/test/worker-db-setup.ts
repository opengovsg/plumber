// This setup file MUST run before any database module is imported.
// It overrides database env vars so each vitest fork worker gets
// its own isolated databases (created in pg-global-setup.ts and tiles-pg-global-setup.ts).
// VITEST_POOL_ID is 1-based and bounded to maxForks (auto-detected from CPU cores).
const workerNum = process.env.VITEST_POOL_ID || '1'
process.env.POSTGRES_DATABASE = `plumber_test_${workerNum}`
process.env.TILES_POSTGRES_DATABASE = `plumber_tiles_test_${workerNum}`
