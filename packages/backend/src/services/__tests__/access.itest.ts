import { randomUUID } from 'crypto'

import type { IFlowCollabRole } from '@plumber/types'
import { beforeEach, describe, expect, it } from 'vitest'

import Flow from '@/models/flow'
import FlowCollaborator from '@/models/flow-collaborators'
import Step from '@/models/step'
import User from '@/models/user'

import { loadAccessibleFlow, loadAccessibleStep } from '../access'

type Member = 'owner' | 'editor' | 'viewer' | 'stranger'

const ACCESS: Record<IFlowCollabRole, Record<Member, boolean>> = {
  viewer: { owner: true, editor: true, viewer: true, stranger: false },
  editor: { owner: true, editor: true, viewer: false, stranger: false },
  owner: { owner: true, editor: false, viewer: false, stranger: false },
}

const CASES = (Object.keys(ACCESS) as IFlowCollabRole[]).flatMap((role) =>
  (Object.keys(ACCESS[role]) as Member[]).map((member) => ({
    role,
    member,
    allowed: ACCESS[role][member],
  })),
)

async function insertUser(): Promise<User> {
  return User.query().insertAndFetch({
    id: randomUUID(),
    email: `access-${randomUUID()}@example.com`,
  })
}

async function insertStep(flowId: string, position: number): Promise<Step> {
  return Step.query().insert({
    key: position === 1 ? 'newSubmission' : 'sendTransactionalEmail',
    appKey: position === 1 ? 'formsg' : 'postman',
    type: position === 1 ? 'trigger' : 'action',
    flowId,
    position,
    parameters: {},
    status: 'completed',
  })
}

describe('access loaders', () => {
  let users: Record<Member, User>
  let flow: Flow
  let steps: Step[]

  beforeEach(async () => {
    users = {
      owner: await insertUser(),
      editor: await insertUser(),
      viewer: await insertUser(),
      stranger: await insertUser(),
    }
    flow = await Flow.query().insert({
      id: randomUUID(),
      name: 'Access Pipe',
      userId: users.owner.id,
    })
    steps = [
      await insertStep(flow.id, 3),
      await insertStep(flow.id, 1),
      await insertStep(flow.id, 2),
    ]
    await FlowCollaborator.query().insert([
      {
        flowId: flow.id,
        userId: users.editor.id,
        role: 'editor',
        updatedBy: users.owner.id,
      },
      {
        flowId: flow.id,
        userId: users.viewer.id,
        role: 'viewer',
        updatedBy: users.owner.id,
      },
    ])
  })

  describe('loadAccessibleFlow', () => {
    it.each(CASES)(
      '$member at $role floor: allowed=$allowed',
      async ({ role, member, allowed }) => {
        const result = await loadAccessibleFlow({
          user: users[member],
          flowId: flow.id,
          role,
        })

        if (allowed) {
          expect(result?.id).toBe(flow.id)
          expect(result?.role).toBe(member)
        } else {
          expect(result).toBeUndefined()
        }
      },
    )

    it('returns undefined for a missing flow', async () => {
      await expect(
        loadAccessibleFlow({
          user: users.owner,
          flowId: randomUUID(),
          role: 'viewer',
        }),
      ).resolves.toBeUndefined()
    })

    it('returns undefined for a soft-deleted collaborator', async () => {
      await FlowCollaborator.query()
        .where({ flow_id: flow.id, user_id: users.editor.id })
        .patch({ deletedAt: new Date().toISOString() })

      await expect(
        loadAccessibleFlow({
          user: users.editor,
          flowId: flow.id,
          role: 'viewer',
        }),
      ).resolves.toBeUndefined()
    })

    it('returns fetched steps in position order', async () => {
      const result = await loadAccessibleFlow({
        user: users.viewer,
        flowId: flow.id,
        role: 'viewer',
        graph: { steps: true },
      })

      expect(result?.steps.map((s) => s.position)).toEqual([1, 2, 3])
    })
  })

  describe('loadAccessibleStep', () => {
    it.each(CASES)(
      '$member at $role floor: allowed=$allowed',
      async ({ role, member, allowed }) => {
        const result = await loadAccessibleStep({
          user: users[member],
          stepId: steps[0].id,
          role,
        })

        if (allowed) {
          expect(result?.id).toBe(steps[0].id)
          expect(result?.flow.id).toBe(flow.id)
          expect(result?.flow.role).toBe(member)
        } else {
          expect(result).toBeUndefined()
        }
      },
    )

    it('returns undefined for a missing step', async () => {
      await expect(
        loadAccessibleStep({
          user: users.owner,
          stepId: randomUUID(),
          role: 'viewer',
        }),
      ).resolves.toBeUndefined()
    })

    it('returns the step when flowId matches', async () => {
      const result = await loadAccessibleStep({
        user: users.editor,
        stepId: steps[1].id,
        flowId: flow.id,
        role: 'editor',
      })

      expect(result?.id).toBe(steps[1].id)
    })

    it('returns undefined when the step belongs to another flow', async () => {
      const otherFlow = await Flow.query().insert({
        id: randomUUID(),
        name: 'Other Pipe',
        userId: users.owner.id,
      })

      await expect(
        loadAccessibleStep({
          user: users.owner,
          stepId: steps[1].id,
          flowId: otherFlow.id,
          role: 'editor',
        }),
      ).resolves.toBeUndefined()
    })

    it('fetches the requested graph', async () => {
      const result = await loadAccessibleStep({
        user: users.owner,
        stepId: steps[1].id,
        role: 'viewer',
        graph: 'flow.steps',
      })

      expect(result?.flow.steps).toHaveLength(3)
    })
  })
})
