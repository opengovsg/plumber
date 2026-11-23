import type { Knex } from 'knex'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { flowAccessTable } from '../tables/flow-access'
import { flowAiSuggestionTable } from '../tables/flow-ai-suggestion'
import { flowStageTable } from '../tables/flow-stage'
import { connectTestDb } from './helpers/test-db'

const CREATOR = '00000000-0000-0000-0000-00000000000a'
const NEW_OWNER = '00000000-0000-0000-0000-00000000000b'
const EDITOR = '00000000-0000-0000-0000-00000000000c'
const VIEWER = '00000000-0000-0000-0000-00000000000d'
const AI_FLOW = '00000000-0000-0000-0000-0000000000f1'
const COPY_FLOW = '00000000-0000-0000-0000-0000000000f2'
const MANUAL_FLOW = '00000000-0000-0000-0000-0000000000f3'
const OLD_FLOW = '00000000-0000-0000-0000-0000000000f4'
const SUGGESTED_STEP = '00000000-0000-0000-0000-0000000000e2'
const COPY_DELETED_AT = new Date('2026-11-12T00:00:00.000Z')

describe('pipe tables against the migrated schema', () => {
  let db: Knex

  beforeAll(async () => {
    db = connectTestDb()
    await db.raw(
      'TRUNCATE users, flows, flow_transfers, flow_collaborators CASCADE',
    )
    await db('users').insert([
      { id: CREATOR, email: 'creator@tech.gov.sg' },
      { id: NEW_OWNER, email: 'new-owner@tech.gov.sg' },
      { id: EDITOR, email: 'editor@tech.gov.sg' },
      { id: VIEWER, email: 'viewer@tech.gov.sg' },
    ])
    const after = new Date('2026-11-10T00:00:00.000Z')
    await db('flows').insert([
      {
        id: AI_FLOW,
        name: 'ai',
        user_id: CREATOR,
        created_at: after,
        config: {
          aiBuilderConfig: {
            traceId: 'trace-1',
            suggested: [
              { position: 1, appKey: 'formsg', key: 'newSubmission' },
              {
                position: 2,
                appKey: 'tiles',
                key: 'createTileRow',
                stepId: SUGGESTED_STEP,
              },
            ],
          },
        },
      },
      {
        id: COPY_FLOW,
        name: 'copy',
        user_id: NEW_OWNER,
        created_at: after,
        deleted_at: COPY_DELETED_AT,
        config: { duplicatedFromFlowId: AI_FLOW },
      },
      {
        id: MANUAL_FLOW,
        name: 'manual',
        user_id: CREATOR,
        created_at: after,
        config: {},
      },
      // Created before duplicates were marked, so its path is unknown.
      {
        id: OLD_FLOW,
        name: 'old',
        user_id: CREATOR,
        created_at: new Date('2026-10-01T00:00:00.000Z'),
        config: {},
      },
    ])
    await db('flow_transfers').insert({
      flow_id: COPY_FLOW,
      old_owner_id: CREATOR,
      new_owner_id: NEW_OWNER,
      status: 'approved',
    })
    await db('flow_collaborators').insert([
      {
        flow_id: COPY_FLOW,
        user_id: EDITOR,
        role: 'editor',
        updated_by: NEW_OWNER,
      },
      // Approving a transfer to a collaborator soft-deletes their collaborator row.
      {
        flow_id: COPY_FLOW,
        user_id: NEW_OWNER,
        role: 'editor',
        updated_by: NEW_OWNER,
        deleted_at: new Date('2026-11-11T00:00:00.000Z'),
      },
      // A removal that passed its check before the pipe was deleted, then committed after.
      {
        flow_id: COPY_FLOW,
        user_id: VIEWER,
        role: 'viewer',
        updated_by: NEW_OWNER,
        deleted_at: new Date('2026-11-13T00:00:00.000Z'),
      },
    ])
  })

  afterAll(async () => {
    await db.destroy()
  })

  it('flow_stage reads the path, owner and creator of each pipe', async () => {
    const rows = await flowStageTable.fetchRows(db)
    const byId = new Map(rows.map((row) => [row.flow_id, row]))

    expect(byId.get(AI_FLOW)).toMatchObject({
      creation_path: 'ai',
      created_by_ai: true,
      ai_trace_id: 'trace-1',
    })
    expect(byId.get(COPY_FLOW)).toMatchObject({
      creation_path: 'duplicate',
      owner_user_id: NEW_OWNER,
      creator_user_id: CREATOR,
    })
    expect(byId.get(MANUAL_FLOW)?.creation_path).toBe('manual')
    expect(byId.get(OLD_FLOW)?.creation_path).toBeNull()
  })

  it('flow_access keeps one row for an owner who was a collaborator', async () => {
    const rows = await flowAccessTable.fetchRows(db)

    expect(
      rows.filter(
        (row) => row.flow_id === COPY_FLOW && row.user_id === NEW_OWNER,
      ),
    ).toEqual([expect.objectContaining({ role: 'owner' })])
  })

  it('flow_access ends collaborator access when the pipe is deleted', async () => {
    const rows = await flowAccessTable.fetchRows(db)
    const copyRows = rows.filter((row) => row.flow_id === COPY_FLOW)

    expect(copyRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ user_id: NEW_OWNER, role: 'owner' }),
        expect.objectContaining({
          user_id: EDITOR,
          role: 'editor',
          deleted_at: COPY_DELETED_AT,
        }),
        expect.objectContaining({
          user_id: VIEWER,
          role: 'viewer',
          deleted_at: COPY_DELETED_AT,
        }),
      ]),
    )
  })

  it('flow_ai_suggestion reads one row per suggested step', async () => {
    const rows = await flowAiSuggestionTable.fetchRows(db)

    expect(rows).toEqual([
      expect.objectContaining({
        flow_id: AI_FLOW,
        position: 1,
        step_id: null,
        app_key: 'formsg',
        action_key: 'newSubmission',
      }),
      expect.objectContaining({
        flow_id: AI_FLOW,
        position: 2,
        step_id: SUGGESTED_STEP,
      }),
    ])
  })
})
