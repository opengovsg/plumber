import type { IGlobalVariable } from '@plumber/types'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ForbiddenError } from '@/errors/graphql-errors'
import StepError from '@/errors/step'
import TableCollaborator from '@/models/table-collaborators'

const $ = {} as IGlobalVariable

function mockCollaborator(
  collaborator: Partial<TableCollaborator> | undefined,
) {
  vi.spyOn(TableCollaborator, 'query').mockReturnValue({
    findOne: vi.fn().mockResolvedValue(collaborator),
  } as never)
}

describe('TableCollaborator.hasAccess', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    ['is not a collaborator', undefined],
    ['is only a viewer', { role: 'viewer' as const }],
  ])(
    'throws a config StepError in a step when the user %s',
    async (_, collaborator) => {
      mockCollaborator(collaborator)

      const promise = TableCollaborator.hasAccess(
        'user-id',
        'table-id',
        'editor',
        $,
      )

      await expect(promise).rejects.toBeInstanceOf(StepError)
      await expect(promise).rejects.toMatchObject({ kind: 'config' })
    },
  )

  it('throws a ForbiddenError outside a step', async () => {
    mockCollaborator(undefined)

    await expect(
      TableCollaborator.hasAccess('user-id', 'table-id', 'editor'),
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('allows a user whose role is high enough', async () => {
    mockCollaborator({ role: 'owner' })

    await expect(
      TableCollaborator.hasAccess('user-id', 'table-id', 'editor', $),
    ).resolves.toBeUndefined()
  })
})
