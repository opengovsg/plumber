import os from 'os'

// Mirror vitest's default maxForks calculation so globalSetup creates
// the same number of worker databases that vitest will actually spawn.
export function getMaxForks(): number {
  return Math.min(20, os.availableParallelism?.() ?? os.cpus().length)
}
