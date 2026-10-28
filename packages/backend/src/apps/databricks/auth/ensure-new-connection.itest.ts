import { randomUUID } from 'crypto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import Connection from '@/models/connection'
import User from '@/models/user'

import { APP_KEY } from '../common/constants'
import { constructSchemaNameFromEmail } from '../common/construct-schema-name'
import { ensureDatabricksConnection } from './ensure-new-connection'
import getSystemAddedConnections from './get-system-added-connections'
import { listDatabricksConnectionsForNewStep } from './list-for-new-step'
import { resolveDatabricksWorkspace } from './resolve-workspace' // pragma: allowlist secret

const NEW_ENV = {
  DATABRICKS_NEW_SERVER_HOSTNAME: 'new.example',
  DATABRICKS_NEW_HTTP_PATH: '/sql/new',
  DATABRICKS_NEW_CATALOG: 'new_catalog',
  DATABRICKS_NEW_CLIENT_ID: 'new-client',
  DATABRICKS_NEW_CLIENT_SECRET: 'new-client-value',
} as const

function stubNewEnv() {
  for (const [key, value] of Object.entries(NEW_ENV)) {
    vi.stubEnv(key, value)
  }
}

function stubGate(enabled: boolean) {
  vi.stubEnv('DATABRICKS_NEW_CONNECTION_ENABLED', enabled ? 'true' : 'false')
}

function storesCredentials(connection: Connection): boolean {
  const blob = JSON.stringify(connection.formattedData ?? {})
  return blob.includes('clientId') || blob.includes('clientSecret')
}

function pointerMatches(
  connection: Connection,
  generation: 'legacy' | 'new',
): boolean {
  const raw = connection.formattedData?.env
  if (typeof raw !== 'string') {
    return false
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return false
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return false
  }
  const record = parsed as Record<string, unknown>
  const keys = Object.keys(record).sort()
  if (keys.length !== 2 || keys[0] !== 'catalog' || keys[1] !== 'hostname') {
    return false
  }
  if (
    typeof record.hostname !== 'string' ||
    typeof record.catalog !== 'string'
  ) {
    return false
  }
  // oxfmt-ignore
  const credentials = resolveDatabricksWorkspace(generation) // pragma: allowlist secret
  return (
    record.hostname === credentials.serverHostname &&
    record.catalog === credentials.catalog
  )
}

async function createUser(): Promise<User> {
  return User.query().insertAndFetch({
    id: randomUUID(),
    email: `owner-${randomUUID()}@plumber.gov.sg`,
  })
}

async function rowsFor(user: User): Promise<Connection[]> {
  return user
    .$relatedQuery('connections')
    .where({ key: APP_KEY })
    .orderBy('created_at', 'asc')
}

describe('ensureDatabricksConnection', () => {
  beforeEach(async () => {
    await Connection.query().delete()
    stubNewEnv()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('inserts one new row when the user has zero rows and the gate is on', async () => {
    stubGate(true)
    const user = await createUser()

    const listed = await getSystemAddedConnections(user)
    const rows = await rowsFor(user)

    expect(listed).toHaveLength(1)
    expect(listed[0].formattedData?.generation).toBe('new')
    expect(rows).toHaveLength(1)
    expect(rows[0].verified).toBe(false)
    expect(rows[0].draft).toBe(false)
    expect(rows[0].formattedData?.screenName).toBe(
      constructSchemaNameFromEmail(user.email),
    )
    expect(pointerMatches(rows[0], 'new')).toBe(true)
    expect(pointerMatches(rows[0], 'legacy')).toBe(false)
    expect(storesCredentials(rows[0])).toBe(false)
  })

  it('inserts one legacy row when the gate is off even if ensure is requested', async () => {
    stubGate(false)
    const user = await createUser()

    await ensureDatabricksConnection(user, true)

    const rows = await rowsFor(user)
    expect(rows).toHaveLength(1)
    expect(rows[0].formattedData?.generation).toBe('legacy')
    expect(rows[0].verified).toBe(false)
    expect(rows[0].draft).toBe(false)
    expect(rows[0].formattedData?.screenName).toBe(
      constructSchemaNameFromEmail(user.email),
    )
    expect(pointerMatches(rows[0], 'legacy')).toBe(true)
    expect(pointerMatches(rows[0], 'new')).toBe(false)
    expect(storesCredentials(rows[0])).toBe(false)
  })

  it('adds one new row beside an existing legacy row when the gate is on', async () => {
    stubGate(true)
    const user = await createUser()
    const screenName = constructSchemaNameFromEmail(user.email)
    await user.$relatedQuery('connections').insert({
      key: APP_KEY,
      formattedData: {
        screenName,
        env: JSON.stringify({ hostname: 'kept', catalog: 'kept' }),
      },
      verified: true,
      draft: false,
    })

    await ensureDatabricksConnection(user, true)

    const rows = await rowsFor(user)
    expect(rows).toHaveLength(2)
    const legacy = rows.find((row) => row.verified === true)
    const created = rows.find((row) => row.formattedData?.generation === 'new')
    if (!legacy || !created) {
      throw new Error('expected a legacy row and a new row')
    }
    expect(legacy.formattedData?.generation).toBeUndefined()
    expect(legacy.formattedData?.env).toBe(
      JSON.stringify({ hostname: 'kept', catalog: 'kept' }),
    )
    expect(created.verified).toBe(false)
    expect(created.draft).toBe(false)
    expect(created.formattedData?.screenName).toBe(screenName)
    expect(pointerMatches(created, 'new')).toBe(true)
    expect(storesCredentials(created)).toBe(false)
  })

  it('inserts nothing when a legacy row exists and ensure is false', async () => {
    stubGate(true)
    const user = await createUser()
    await user.$relatedQuery('connections').insert({
      key: APP_KEY,
      formattedData: {
        screenName: constructSchemaNameFromEmail(user.email),
        generation: 'legacy',
        env: JSON.stringify({ hostname: 'kept', catalog: 'kept' }),
      },
      verified: true,
      draft: false,
    })

    await ensureDatabricksConnection(user, false)

    const rows = await rowsFor(user)
    expect(rows).toHaveLength(1)
    expect(rows[0].formattedData?.generation).toBe('legacy')
    expect(rows[0].verified).toBe(true)
  })

  it('lists nothing new from My Apps when a legacy row already exists', async () => {
    stubGate(true)
    const user = await createUser()
    await user.$relatedQuery('connections').insert({
      key: APP_KEY,
      formattedData: {
        screenName: constructSchemaNameFromEmail(user.email),
        generation: 'legacy',
        env: JSON.stringify({ hostname: 'kept', catalog: 'kept' }),
      },
      verified: true,
      draft: false,
    })

    const listed = await getSystemAddedConnections(user)
    const rows = await rowsFor(user)

    expect(listed).toHaveLength(1)
    expect(rows).toHaveLength(1)
    expect(rows[0].formattedData?.generation).toBe('legacy')
    expect(rows[0].verified).toBe(true)
    expect(listed[0].id).toBe(rows[0].id)
  })

  it('returns one new row for a new step when a legacy row already exists', async () => {
    stubGate(true)
    const user = await createUser()
    await user.$relatedQuery('connections').insert({
      key: APP_KEY,
      formattedData: {
        screenName: constructSchemaNameFromEmail(user.email),
        generation: 'legacy',
        env: JSON.stringify({ hostname: 'kept', catalog: 'kept' }),
      },
      verified: true,
      draft: false,
    })

    const first = await listDatabricksConnectionsForNewStep(user)
    const second = await listDatabricksConnectionsForNewStep(user)
    const rows = await rowsFor(user)
    const created = rows.find((row) => row.formattedData?.generation === 'new')
    const legacy = rows.find(
      (row) => row.formattedData?.generation === 'legacy',
    )

    expect(first).toHaveLength(1)
    expect(second).toHaveLength(1)
    expect(rows).toHaveLength(2)
    if (!created || !legacy) {
      throw new Error('expected a legacy row and a new row')
    }
    expect(first[0].id).toBe(created.id)
    expect(second[0].id).toBe(created.id)
    expect(legacy.verified).toBe(true)
    expect(created.verified).toBe(false)
  })

  it('inserts nothing on a second ensure and leaves the new row unverified', async () => {
    stubGate(true)
    const user = await createUser()

    await ensureDatabricksConnection(user, true)
    await ensureDatabricksConnection(user, true)
    await ensureDatabricksConnection(user, false)

    const rows = await rowsFor(user)
    expect(rows).toHaveLength(1)
    expect(rows[0].formattedData?.generation).toBe('new')
    expect(rows[0].verified).toBe(false)
  })
})
