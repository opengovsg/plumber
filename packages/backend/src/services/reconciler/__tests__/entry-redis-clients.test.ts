import fs from 'fs'
import path from 'path'

import { describe, expect, it } from 'vitest'

import { collectReachableFiles, SRC_DIR } from './import-graph'

// Unlistened clients print to stderr during the Redis outage this process must report.
const FILES_ALLOWED_TO_CREATE_REDIS_CLIENTS = ['services/reconciler/redis.ts']

describe('reconciler Redis clients', () => {
  it('creates Redis clients only in files that log their errors', () => {
    const reached = collectReachableFiles(path.join(SRC_DIR, 'reconciler.ts'))

    const filesCreatingClients = [...reached]
      .filter((file) =>
        /createRedisClient\(|new Redis\(/.test(fs.readFileSync(file, 'utf8')),
      )
      .map((file) => path.relative(SRC_DIR, file))

    expect(filesCreatingClients.sort()).toEqual(
      FILES_ALLOWED_TO_CREATE_REDIS_CLIENTS,
    )
  })
})
