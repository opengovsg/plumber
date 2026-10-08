// Business rule: preserve the topology for toolbox logic.
import type { IStepConfig, ITemplateStep } from '@plumber/types'

import { beforeEach, describe, expect, it } from 'vitest'

import apps from '@/apps'
import { getStepIdToSkipTo } from '@/apps/toolbox/common/get-step-id-to-skip-to'
import Flow from '@/models/flow'
import Step from '@/models/step'
import Template from '@/models/template'
import User from '@/models/user'

import { convertFlowToTemplate } from '../convert-flow-to-template'
import { createFlowFromTemplate } from '../flow-templates'
import globalVariable from '../global-variable'

const conditions = [
  { rows: [{ field: 'a', is: 'is', condition: 'equals', text: 'b' }] },
]

describe('template Toolbox topology', () => {
  let owner: User

  beforeEach(async () => {
    await Step.query().delete()
    await Template.query().delete()
    await Flow.query().delete()
    owner = await User.query()
      .findOne({ email: 'tester@open.gov.sg' })
      .throwIfNotFound()
  })

  async function saveTemplate(steps: ITemplateStep[]): Promise<string> {
    const template = await Template.query().insertGraph({
      name: 'Topology template',
      description: '',
      userId: owner.id,
      templateSteps: steps.map((data) => ({ data })),
    })
    return template.id
  }

  it('round-trips a block with Only continue if, Repeat, and a forward boundary', async () => {
    const source = await owner.$relatedQuery('flows').insert({ name: 'Source' })
    const trigger = await source.$relatedQuery('steps').insert({
      type: 'trigger',
      position: 1,
      appKey: 'webhook',
      key: 'catchRawWebhook',
      parameters: {},
    })
    const block = await source.$relatedQuery('steps').insert({
      type: 'action',
      position: 2,
      appKey: 'toolbox',
      key: 'ifThen',
      parameters: { branchName: 'Branch', conditions },
      config: { stepName: 'Check' },
    })
    await source.$relatedQuery('steps').insert({
      type: 'action',
      position: 3,
      appKey: 'toolbox',
      key: 'onlyContinueIf',
      parameters: { conditions },
    })
    const repeat = await source.$relatedQuery('steps').insert({
      type: 'action',
      position: 4,
      appKey: 'toolbox',
      key: 'forEach',
      parameters: { items: `{{step.${trigger.id}.items}}` },
    })
    const end = await source.$relatedQuery('steps').insert({
      type: 'action',
      position: 5,
      appKey: 'postman',
      key: 'sendTransactionalEmail',
      parameters: { body: `{{step.${repeat.id}.item}}` },
    })
    await source.$relatedQuery('steps').insert({
      type: 'action',
      position: 6,
      appKey: 'postman',
      key: 'sendTransactionalEmail',
      parameters: {},
    })
    await block
      .$query()
      .patch({ config: { ...block.config, endStepId: end.id } })
    const sourceSteps = await source.$relatedQuery('steps').orderBy('position')
    const exported = convertFlowToTemplate(
      { name: source.name, steps: sourceSteps },
      { id: source.id, description: '' },
    )
    expect(exported.steps[1].config?.endStepId).toBe('<<step_id_5>>')
    const templateId = await saveTemplate(exported.steps)
    const created = await createFlowFromTemplate(templateId, owner)
    const steps = await created.$relatedQuery('steps').orderBy('position')

    expect(steps[1].config).toMatchObject({
      stepName: 'Check',
      endStepId: steps[4].id,
    })
    expect(steps[1].config.endStepId).not.toBe(end.id)
    expect(steps[3].parameters.items).toBe(`{{step.${steps[0].id}.items}}`)
    expect(steps[4].parameters.body).toBe(`{{step.${steps[3].id}.item}}`)
    expect(
      await getStepIdToSkipTo(
        await globalVariable({
          app: apps.toolbox,
          flow: created,
          step: steps[1],
        }),
      ),
    ).toBe(steps[5].id)
    expect(
      await getStepIdToSkipTo(
        await globalVariable({
          app: apps.toolbox,
          flow: created,
          step: steps[2],
        }),
      ),
    ).toBe(steps[5].id)
    expect((await block.$query()).config.endStepId).toBe(end.id)
    expect(
      (await Template.findOneForUser(owner.id, templateId)).steps[1].config
        ?.endStepId,
    ).toBe('<<step_id_5>>')
  })

  it('preserves an empty self-referencing block', async () => {
    const templateId = await saveTemplate([
      { position: 1, appKey: 'webhook', eventKey: 'catchRawWebhook' },
      {
        position: 2,
        appKey: 'toolbox',
        eventKey: 'ifThen',
        parameters: { conditions },
        config: { endStepId: '<<step_id_2>>' },
      },
    ])
    const flow = await createFlowFromTemplate(templateId, owner)
    const step = await flow.$relatedQuery('steps').findOne({ position: 2 })
    expect(step.config.endStepId).toBe(step.id)
  })

  it('remaps a block and Only continue if inside an MRF rejection branch', async () => {
    const approval = { branch: 'reject' as const, stepId: '<<step_id_2>>' }
    const templateId = await saveTemplate([
      { position: 1, appKey: 'formsg', eventKey: 'newSubmission' },
      { position: 2, appKey: 'formsg', eventKey: 'mrfSubmission' },
      {
        position: 3,
        appKey: 'toolbox',
        eventKey: 'ifThen',
        parameters: { conditions },
        config: { approval, endStepId: '<<step_id_5>>' },
      },
      {
        position: 4,
        appKey: 'toolbox',
        eventKey: 'onlyContinueIf',
        parameters: { conditions },
        config: { approval },
      },
      {
        position: 5,
        appKey: 'postman',
        eventKey: 'sendTransactionalEmail',
        config: { approval },
      },
      { position: 6, appKey: 'postman', eventKey: 'sendTransactionalEmail' },
    ])
    const flow = await createFlowFromTemplate(templateId, owner)
    const steps = await flow.$relatedQuery('steps').orderBy('position')
    expect(steps[2].config.endStepId).toBe(steps[4].id)
    for (const step of steps.slice(2, 5)) {
      expect(step.config.approval).toEqual({
        branch: 'reject',
        stepId: steps[1].id,
      })
    }
    expect(
      await getStepIdToSkipTo(
        await globalVariable({
          app: apps.toolbox,
          flow,
          step: steps[2],
        }),
      ),
    ).toBeNull()
  })

  it('leaves legacy If depth and branch names unchanged without adding a V2 marker', async () => {
    const templateId = await saveTemplate([
      { position: 1, appKey: 'webhook', eventKey: 'catchRawWebhook' },
      {
        position: 2,
        appKey: 'toolbox',
        eventKey: 'ifThen',
        parameters: { depth: 0, branchName: 'Legacy', conditions },
      },
    ])
    const flow = await createFlowFromTemplate(templateId, owner)
    const step = await flow.$relatedQuery('steps').findOne({ position: 2 })
    expect(step.config).not.toHaveProperty('endStepId')
    expect(step.parameters).toMatchObject({
      depth: 0,
      branchName: 'Legacy',
      conditions,
    })
  })

  it.each<[string, IStepConfig]>([
    ['dangling boundary', { endStepId: '<<step_id_99>>' }],
    ['boundary before the block', { endStepId: '<<step_id_1>>' }],
    [
      'rejection owner outside the flow',
      { approval: { branch: 'reject', stepId: '<<step_id_99>>' } },
    ],
    [
      'rejection owner that is not MRF',
      { approval: { branch: 'reject', stepId: '<<step_id_1>>' } },
    ],
  ])('rejects %s and rolls back flow creation', async (_reason, config) => {
    const templateId = await saveTemplate([
      { position: 1, appKey: 'webhook', eventKey: 'catchRawWebhook' },
      {
        position: 2,
        appKey: 'toolbox',
        eventKey: 'ifThen',
        parameters: { conditions },
        config,
      },
    ])
    const before = await Flow.query().resultSize()
    await expect(createFlowFromTemplate(templateId, owner)).rejects.toThrow()
    expect(await Flow.query().resultSize()).toBe(before)
    expect(await Step.query().resultSize()).toBe(0)
  })
})
