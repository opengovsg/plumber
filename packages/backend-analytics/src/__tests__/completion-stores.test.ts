import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { claimLocalExportDir } from '../completion-stores'

describe('claimLocalExportDir', () => {
  it('ties a folder to the database that first wrote it', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'export-'))
    const prod = { appEnv: 'prod', host: 'prod-reader', database: 'plumber' }
    try {
      await claimLocalExportDir(dir, prod)
      await claimLocalExportDir(dir, prod)

      await expect(
        claimLocalExportDir(dir, { ...prod, appEnv: 'staging' }),
      ).rejects.toThrow(
        'holds an export from prod (prod-reader/plumber), but this run reads staging (prod-reader/plumber)',
      )
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
