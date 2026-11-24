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

  it('ties a folder to the log group that first wrote its mutation log', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'export-'))
    const prod = { appEnv: 'prod', host: 'prod-reader', database: 'plumber' }
    try {
      await claimLocalExportDir(dir, prod)
      await claimLocalExportDir(dir, { ...prod, logGroup: 'prod-server' })
      await claimLocalExportDir(dir, prod)

      await expect(
        claimLocalExportDir(dir, { ...prod, logGroup: 'staging-server' }),
      ).rejects.toThrow(
        'holds an export from prod (prod-reader/plumber, prod-server), but this run reads prod (prod-reader/plumber, staging-server)',
      )
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
