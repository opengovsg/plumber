import type { IJSONObject, ITemplate, ITemplateStep } from '@plumber/types'
import { describe, expect, it, vi } from 'vitest'

import { tilesClient } from '@/config/tiles-database'
import { generateMockUser } from '@/graphql/__tests__/mutations/flow.mock'
import { createFlowFromTemplate } from '@/helpers/flow-templates'

const { TEST_TEMPLATES } = vi.hoisted(() => {
  const trigger: ITemplateStep = {
    position: 1,
    appKey: 'formsg',
    eventKey: 'newSubmission',
  }
  const tile = (
    rowData: IJSONObject[] = [{ Email: 'a@open.gov.sg' }],
  ): ITemplateStep => ({
    position: 2,
    appKey: 'tiles',
    eventKey: 'createTileRow',
    templateData: { name: 'Table', columns: ['Email'], rowData },
  })
  const ifThen = (config: ITemplateStep['config']): ITemplateStep => ({
    position: 3,
    appKey: 'toolbox',
    eventKey: 'ifThen',
    config,
  })
  const email: ITemplateStep = {
    position: 4,
    appKey: 'postman',
    eventKey: 'sendTransactionalEmail',
  }
  const template = (id: string, steps: ITemplateStep[]): ITemplate => ({
    id,
    name: id,
    description: '',
    steps,
  })

  return {
    TEST_TEMPLATES: {
      valid: template('00000000-0000-4000-8000-000000000001', [
        trigger,
        tile(),
        ifThen({ endStepId: '<<step_id_4>>' }),
        email,
      ]),
      unknownStep: template('00000000-0000-4000-8000-000000000002', [
        trigger,
        tile(),
        ifThen({ endStepId: '<<step_id_9>>' }),
        email,
      ]),
      boundaryBeforeBlock: template('00000000-0000-4000-8000-000000000003', [
        trigger,
        tile(),
        ifThen({ endStepId: '<<step_id_1>>' }),
        email,
      ]),
      nonMrfApproval: template('00000000-0000-4000-8000-000000000004', [
        trigger,
        tile(),
        {
          ...email,
          config: { approval: { branch: 'reject', stepId: '<<step_id_1>>' } },
        },
      ]),
      unknownColumn: template('00000000-0000-4000-8000-000000000005', [
        trigger,
        tile([{ Missing: 'a@open.gov.sg' }]),
      ]),
    },
  }
})

vi.mock('@/db/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/db/storage')>()
  return {
    ...actual,
    TEMPLATES: [...actual.TEMPLATES, ...Object.values(TEST_TEMPLATES)],
  }
})

async function countTileTables(): Promise<number> {
  const [{ count }] = await tilesClient('information_schema.tables')
    .where({ table_schema: 'public' })
    .count({ count: '*' })
  return Number(count)
}

describe('createFlowFromTemplate tile cleanup', () => {
  it('creates one tile table for a valid template', async () => {
    const user = await generateMockUser('owner')
    const before = await countTileTables()

    await createFlowFromTemplate(TEST_TEMPLATES.valid.id, user)

    expect(await countTileTables()).toBe(before + 1)
  })

  it.each([
    ['an unknown step reference', TEST_TEMPLATES.unknownStep],
    ['a boundary before its block', TEST_TEMPLATES.boundaryBeforeBlock],
    ['a rejection branch without an MRF step', TEST_TEMPLATES.nonMrfApproval],
    ['a row key that is not a column', TEST_TEMPLATES.unknownColumn],
  ])('leaves no tile table for %s', async (_name, template) => {
    const user = await generateMockUser('owner')
    const before = await countTileTables()

    await expect(createFlowFromTemplate(template.id, user)).rejects.toThrow()

    expect(await countTileTables()).toBe(before)
  })
})
