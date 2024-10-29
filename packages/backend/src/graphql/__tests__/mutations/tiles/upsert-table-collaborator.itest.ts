import { beforeEach, describe, expect, it } from 'vitest'

import { BadUserInputError, ForbiddenError } from '@/errors/graphql-errors'
import TableMetadata from '@/models/table-metadata'
import User from '@/models/user'
import Context from '@/types/express/context'

import upsertTableCollaborator from '../../../mutations/tiles/upsert-table-collaborator'

import { generateMockContext, generateMockTable } from './table.mock'

describe('update table collaborators', () => {
  let context: Context
  let dummyTable: TableMetadata
  let editor: User
  let owner: User
  let viewer: User

  beforeEach(async () => {
    context = await generateMockContext()

    const mockTable = await generateMockTable({
      userId: context.currentUser.id,
    })
    dummyTable = mockTable.table
    editor = mockTable.editor
    owner = mockTable.owner
    viewer = mockTable.viewer
  })

  it('should be able to add new viewers', async () => {
    await upsertTableCollaborator(
      null,
      {
        input: {
          tableId: dummyTable.id,
          email: 'viewer2@open.gov.sg',
          role: 'viewer',
        },
      },
      context,
    )
    const collaborators = await dummyTable
      .$relatedQuery('collaborators')
      .where('table_collaborators.deleted_at', null)
    expect(collaborators).toHaveLength(4)
    const addedCollaborator = collaborators.find(
      (col) => col.email === 'viewer2@open.gov.sg',
    )
    expect(addedCollaborator).toHaveProperty('role', 'viewer')
  })

  it('should be able to add new editors', async () => {
    await upsertTableCollaborator(
      null,
      {
        input: {
          tableId: dummyTable.id,
          email: 'editor2@open.gov.sg',
          role: 'editor',
        },
      },
      context,
    )
    const collaborators = await dummyTable
      .$relatedQuery('collaborators')
      .where('table_collaborators.deleted_at', null)
    expect(collaborators).toHaveLength(4)
    const addedCollaborator = collaborators.find(
      (col) => col.email === 'editor2@open.gov.sg',
    )
    expect(addedCollaborator).toHaveProperty('role', 'editor')
  })

  it('should be able to update roles', async () => {
    await upsertTableCollaborator(
      null,
      {
        input: {
          tableId: dummyTable.id,
          email: 'editor@open.gov.sg',
          role: 'viewer',
        },
      },
      context,
    )
    const collaborators = await dummyTable
      .$relatedQuery('collaborators')
      .where('table_collaborators.deleted_at', null)
    expect(collaborators).toHaveLength(3)
    const addedCollaborator = collaborators.find(
      (col) => col.email === 'editor@open.gov.sg',
    )
    expect(addedCollaborator).toHaveProperty('role', 'viewer')
  })

  it('should not allow editing role of owner', async () => {
    context.currentUser = editor
    await expect(
      upsertTableCollaborator(
        null,
        {
          input: {
            tableId: dummyTable.id,
            email: owner.email,
            role: 'editor',
          },
        },
        context,
      ),
    ).rejects.toThrow()
  })

  it('should not allow editing of own role', async () => {
    context.currentUser = editor
    await expect(
      upsertTableCollaborator(
        null,
        {
          input: {
            tableId: dummyTable.id,
            email: context.currentUser.email,
            role: 'editor',
          },
        },
        context,
      ),
    ).rejects.toThrow('Cannot change own role')
  })
  it('should not allow editing of own role', async () => {
    context.currentUser = editor
    await expect(
      upsertTableCollaborator(
        null,
        {
          input: {
            tableId: dummyTable.id,
            email: context.currentUser.email,
            role: 'editor',
          },
        },
        context,
      ),
    ).rejects.toThrow('Cannot change own role')
  })

  it('should only not allow viewers to modify collaborators', async () => {
    context.currentUser = viewer
    await expect(
      upsertTableCollaborator(
        null,
        {
          input: {
            tableId: dummyTable.id,
            email: 'tester33@open.gov.sg',
            role: 'editor',
          },
        },
        context,
      ),
    ).rejects.toThrow(ForbiddenError)
  })

  describe('transfer ownership', () => {
    it('should not allow adding of owner role if you are not owner', async () => {
      context.currentUser = editor
      await expect(
        upsertTableCollaborator(
          null,
          {
            input: {
              tableId: dummyTable.id,
              email: 'owner2@open.gov.sg',
              role: 'owner',
            },
          },
          context,
        ),
      ).rejects.toThrowError(ForbiddenError)
    })

    it('should allow transfer of owner role if you are owner, old owner will become editor', async () => {
      await expect(
        upsertTableCollaborator(
          null,
          {
            input: {
              tableId: dummyTable.id,
              email: editor.email,
              role: 'owner',
            },
          },
          context,
        ),
      ).resolves.not.toThrow()
      const collaborators = await dummyTable
        .$relatedQuery('collaborators')
        .where('table_collaborators.deleted_at', null)
      expect(
        collaborators.find((col) => col.email === editor.email),
      ).toHaveProperty('role', 'owner')
      expect(
        collaborators.find((col) => col.email === owner.email),
      ).toHaveProperty('role', 'editor')
    })

    it('should not allow transfer of ownership to non-existent user', async () => {
      await expect(
        upsertTableCollaborator(
          null,
          {
            input: {
              tableId: dummyTable.id,
              email: 'non-existent-user@open.gov.sg',
              role: 'owner',
            },
          },
          context,
        ),
      ).rejects.toThrowError(BadUserInputError)
    })
  })
})
