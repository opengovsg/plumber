/**
 * Unit tests run without Redis or Postgres. Connection code must not dial out
 * or exit the process there, or vitest loses its pool worker and aborts the
 * whole run with ERR_IPC_CHANNEL_CLOSED ("Channel closed").
 *
 * IMPORTANT: only packages/backend/vitest.config.ts sets this. Integration
 * tests have real services, so they keep the production behaviour.
 */
export const isUnitTestRun = process.env.PLUMBER_UNIT_TESTS === '1'
