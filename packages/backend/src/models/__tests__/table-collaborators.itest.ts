import { randomUUID } from 'crypto'

import { ITableCollabRole } from '@plumber/types'
import { beforeEach, describe, expect, it } from 'vitest'

import { ForbiddenError } from '@/errors/graphql-errors'

import TableCollaborator from '../table-collaborators'
import TableMetadata from '../table-metadata'
import User from '../user'

describe('table collaborators model', () => {
  let tableId: string
  let owner: User
  let editor: User
  let viewer: User

  beforeEach(async () => {
    owner = await User.query().insertAndFetch({
      id: randomUUID(),
      email: 'owner@plumber.gov.sg',
    })
    editor = await User.query().insertAndFetch({
      id: randomUUID(),
      email: 'editor@plumber.gov.sg',
    })
    viewer = await User.query().insertAndFetch({
      id: randomUUID(),
      email: 'viewer@plumber.gov.sg',
    })

    const table = await TableMetadata.query().insertAndFetch({
      name: 'Test Table',
      db: 'pg',
    })
    tableId = table.id

    await TableCollaborator.query().insert([
      {
        tableId,
        userId: owner.id,
        role: 'owner',
      },
      {
        tableId,
        userId: editor.id,
        role: 'editor',
      },
      {
        tableId,
        userId: viewer.id,
        role: 'viewer',
      },
    ])
  })

  describe('hasAccess', () => {
    it.each([
      { userRole: 'owner', requiredRole: 'owner' },
      { userRole: 'owner', requiredRole: 'editor' },
      { userRole: 'owner', requiredRole: 'viewer' },
      { userRole: 'editor', requiredRole: 'editor' },
      { userRole: 'editor', requiredRole: 'viewer' },
      { userRole: 'viewer', requiredRole: 'viewer' },
    ] as { userRole: ITableCollabRole; requiredRole: ITableCollabRole }[])(
      'should not throw when $userRole accesses with $requiredRole requirement',
      async ({ userRole, requiredRole }) => {
        const user =
          userRole === 'owner' ? owner : userRole === 'editor' ? editor : viewer

        await expect(
          TableCollaborator.hasAccess(user.id, tableId, requiredRole),
        ).resolves.not.toThrow()
      },
    )

    it.each([
      { userRole: 'editor', requiredRole: 'owner' },
      { userRole: 'viewer', requiredRole: 'owner' },
      { userRole: 'viewer', requiredRole: 'editor' },
    ] as { userRole: ITableCollabRole; requiredRole: ITableCollabRole }[])(
      'should throw when $userRole accesses with $requiredRole requirement',
      async ({ userRole, requiredRole }) => {
        const user = userRole === 'editor' ? editor : viewer

        await expect(
          TableCollaborator.hasAccess(user.id, tableId, requiredRole),
        ).rejects.toThrow(ForbiddenError)
      },
    )

    it('should throw when user is not a collaborator', async () => {
      const nonCollaborator = await User.query().insertAndFetch({
        id: randomUUID(),
        email: 'stranger@plumber.gov.sg',
      })

      await expect(
        TableCollaborator.hasAccess(nonCollaborator.id, tableId, 'viewer'),
      ).rejects.toThrow(ForbiddenError)
    })

    it('should throw when table does not exist', async () => {
      await expect(
        TableCollaborator.hasAccess(owner.id, randomUUID(), 'viewer'),
      ).rejects.toThrow(ForbiddenError)
    })
  })

  describe('upgradeOrInsertCollaborator', () => {
    it('should insert a new collaborator when none exists', async () => {
      const newUser = await User.query().insertAndFetch({
        id: randomUUID(),
        email: 'new_user@plumber.gov.sg',
      })

      await TableCollaborator.upgradeOrInsertCollaborator({
        userId: newUser.id,
        tableId,
        role: 'editor',
      })

      const collaborator = await TableCollaborator.query().findOne({
        user_id: newUser.id,
        table_id: tableId,
      })
      expect(collaborator).toBeDefined()
      expect(collaborator?.role).toBe('editor')
    })

    it('should upgrade viewer to editor', async () => {
      await TableCollaborator.upgradeOrInsertCollaborator({
        userId: viewer.id,
        tableId,
        role: 'editor',
      })

      const collaborator = await TableCollaborator.query().findOne({
        user_id: viewer.id,
        table_id: tableId,
      })
      expect(collaborator?.role).toBe('editor')
    })

    it.each([
      { currentRole: 'owner', newRole: 'owner' },
      { currentRole: 'owner', newRole: 'editor' },
      { currentRole: 'owner', newRole: 'viewer' },
      { currentRole: 'editor', newRole: 'editor' },
      { currentRole: 'editor', newRole: 'viewer' },
      { currentRole: 'viewer', newRole: 'viewer' },
    ] as { currentRole: ITableCollabRole; newRole: ITableCollabRole }[])(
      'should no-op when changing $currentRole to $newRole (same or less permissive)',
      async ({ currentRole, newRole }) => {
        const testUser = await User.query().insertAndFetch({
          id: randomUUID(),
          email: 'test_user@plumber.gov.sg',
        })

        await TableCollaborator.query().insert({
          tableId,
          userId: testUser.id,
          role: currentRole,
        })

        await TableCollaborator.upgradeOrInsertCollaborator({
          userId: testUser.id,
          tableId,
          role: newRole,
        })

        const collaborator = await TableCollaborator.query().findOne({
          user_id: testUser.id,
          table_id: tableId,
        })
        expect(collaborator?.role).toBe(currentRole)
      },
    )

    describe('soft-deleted collaborators', () => {
      it('should restore soft-deleted collaborator with the new role', async () => {
        // Soft delete the editor
        await TableCollaborator.query()
          .patch({ deletedAt: new Date().toISOString() })
          .where({ user_id: editor.id, table_id: tableId })

        // Verify soft deleted
        const beforeRestore = await TableCollaborator.query().findOne({
          user_id: editor.id,
          table_id: tableId,
        })
        expect(beforeRestore).toBeUndefined()

        // Try to add back as viewer (less permissive than original editor role)
        await TableCollaborator.upgradeOrInsertCollaborator({
          userId: editor.id,
          tableId,
          role: 'viewer',
        })

        // Should be restored with the new role
        const afterRestore = await TableCollaborator.query().findOne({
          user_id: editor.id,
          table_id: tableId,
        })
        expect(afterRestore).toBeDefined()
        expect(afterRestore?.role).toBe('viewer')
        expect(afterRestore?.deletedAt).toBeNull()
      })

      it('should restore soft-deleted collaborator with same role', async () => {
        // Soft delete the viewer
        await TableCollaborator.query()
          .patch({ deletedAt: new Date().toISOString() })
          .where({ user_id: viewer.id, table_id: tableId })

        // Try to add back as viewer (same role)
        await TableCollaborator.upgradeOrInsertCollaborator({
          userId: viewer.id,
          tableId,
          role: 'viewer',
        })

        // Should be restored
        const afterRestore = await TableCollaborator.query().findOne({
          user_id: viewer.id,
          table_id: tableId,
        })
        expect(afterRestore).toBeDefined()
        expect(afterRestore?.role).toBe('viewer')
        expect(afterRestore?.deletedAt).toBeNull()
      })

      it('should restore soft-deleted collaborator with upgraded role', async () => {
        // Soft delete the viewer
        await TableCollaborator.query()
          .patch({ deletedAt: new Date().toISOString() })
          .where({ user_id: viewer.id, table_id: tableId })

        // Verify soft deleted
        const beforeRestore = await TableCollaborator.query().findOne({
          user_id: viewer.id,
          table_id: tableId,
        })
        expect(beforeRestore).toBeUndefined()

        // Try to add back as editor (more permissive)
        await TableCollaborator.upgradeOrInsertCollaborator({
          userId: viewer.id,
          tableId,
          role: 'editor',
        })

        // Should be restored with upgraded role
        const afterRestore = await TableCollaborator.query().findOne({
          user_id: viewer.id,
          table_id: tableId,
        })
        expect(afterRestore).toBeDefined()
        expect(afterRestore?.role).toBe('editor')
        expect(afterRestore?.deletedAt).toBeNull()
      })
    })
  })
})
