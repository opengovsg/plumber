import { beforeEach, describe, expect, it } from 'vitest'

import { TEMPLATES } from '@/db/storage'
import createTemplateFromFlow from '@/graphql/mutations/create-template-from-flow'
import getTemplates from '@/graphql/queries/get-templates'
import { createFlowFromTemplate } from '@/helpers/flow-templates'
import Flow from '@/models/flow'
import Step from '@/models/step'
import Template from '@/models/template'
import User from '@/models/user'
import Context from '@/types/express/context'

describe('createTemplateFromFlow', () => {
  let owner: User
  let context: Context

  beforeEach(async () => {
    await Step.query().delete()
    await Template.query().delete()
    await Flow.query().delete()

    owner = await User.query().findOne({ email: 'tester@open.gov.sg' })
    context = {
      req: null,
      currentUser: owner,
      res: null,
      isAdminOperation: false,
    } as unknown as Context
  })

  it('saves the template and its steps with step id placeholders', async () => {
    const flow = await owner.$relatedQuery('flows').insertAndFetch({
      name: 'Source Flow',
      updatedBy: owner.id,
    })
    const trigger = await flow.$relatedQuery('steps').insertAndFetch({
      key: 'newSubmission',
      appKey: 'formsg',
      type: 'trigger',
      position: 1,
      parameters: {},
    })
    await flow.$relatedQuery('steps').insert({
      key: 'sendTransactionalEmail',
      appKey: 'postman',
      type: 'action',
      position: 2,
      parameters: { body: `Hi {{step.${trigger.id}.fields.a.answer}}` },
    })

    const result = await createTemplateFromFlow(
      null,
      { input: { flowId: flow.id } },
      context,
    )

    const template = await Template.query()
      .findById(result.id)
      .withGraphFetched({ steps: true })
      .throwIfNotFound()

    expect(template).toMatchObject({
      name: 'Source Flow',
      description: '',
      userId: owner.id,
    })
    expect(
      template.steps.map(({ type, position, appKey, key, flowId }) => ({
        type,
        position,
        appKey,
        key,
        flowId,
      })),
    ).toEqual([
      {
        type: 'trigger',
        position: 1,
        appKey: 'formsg',
        key: 'newSubmission',
        flowId: null,
      },
      {
        type: 'action',
        position: 2,
        appKey: 'postman',
        key: 'sendTransactionalEmail',
        flowId: null,
      },
    ])
    expect(template.steps[1].parameters).toEqual({
      body: 'Hi {{step.<<step_id_1>>.fields.a.answer}}',
    })
  })

  async function seedTemplate(): Promise<{ templateId: string }> {
    const flow = await owner.$relatedQuery('flows').insertAndFetch({
      name: 'Source Flow',
      updatedBy: owner.id,
    })
    const trigger = await flow.$relatedQuery('steps').insertAndFetch({
      key: 'newSubmission',
      appKey: 'formsg',
      type: 'trigger',
      position: 1,
      parameters: {},
    })
    await flow.$relatedQuery('steps').insert({
      key: 'sendTransactionalEmail',
      appKey: 'postman',
      type: 'action',
      position: 2,
      parameters: { body: `Hi {{step.${trigger.id}.fields.a.answer}}` },
    })
    const { id } = await createTemplateFromFlow(
      null,
      { input: { flowId: flow.id } },
      context,
    )
    return { templateId: id }
  }

  it('lists the user template before the built-in templates', async () => {
    const { templateId } = await seedTemplate()

    const templates = await getTemplates(null, {}, context, null)

    expect(templates.map((template) => template.id)).toEqual([
      templateId,
      ...TEMPLATES.map((template) => template.id),
    ])
  })

  it('excludes user templates from tagged queries', async () => {
    const { templateId } = await seedTemplate()

    const templates = await getTemplates(null, { tag: 'demo' }, context, null)

    expect(templates.map((template) => template.id)).not.toContain(templateId)
  })

  it('hides a user template from other users', async () => {
    const { templateId } = await seedTemplate()
    const otherUser = await User.query().insertAndFetch({
      email: `other-${Date.now()}@open.gov.sg`,
    })

    await expect(createFlowFromTemplate(templateId, otherUser)).rejects.toThrow(
      'Invalid template id input',
    )
  })

  it('creates a flow from a user template with fresh step ids', async () => {
    const { templateId } = await seedTemplate()

    const newFlow = await createFlowFromTemplate(templateId, owner)

    const steps = await newFlow.$relatedQuery('steps').orderBy('position')
    expect(newFlow.name).toBe('Source Flow')
    expect(steps.map((step) => step.key)).toEqual([
      'newSubmission',
      'sendTransactionalEmail',
    ])
    expect(steps[1].parameters).toEqual({
      body: `Hi {{step.${steps[0].id}.fields.a.answer}}`,
    })
  })

  it('leaves the source flow steps untouched', async () => {
    const flow = await owner.$relatedQuery('flows').insertAndFetch({
      name: 'Source Flow',
      updatedBy: owner.id,
    })
    await flow.$relatedQuery('steps').insert({
      key: 'newSubmission',
      appKey: 'formsg',
      type: 'trigger',
      position: 1,
      parameters: {},
    })

    await createTemplateFromFlow(null, { input: { flowId: flow.id } }, context)

    expect(await flow.$relatedQuery('steps').resultSize()).toBe(1)
  })
})
