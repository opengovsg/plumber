import { describe, expect, it } from 'vitest'

import {
  getIfBlockPreviewTitle,
  getRepeatBlockPreviewTitle,
} from '../previewBlockTitle'
import type { PreviewStep } from '../previewItems'

function step(key: string, extra: Partial<PreviewStep> = {}): PreviewStep {
  return {
    id: key,
    appKey: 'toolbox',
    key,
    type: 'action',
    position: 1,
    parameters: {},
    ...extra,
  } as PreviewStep
}

describe('preview block titles', () => {
  it('uses the branch name until a condition is saved', () => {
    expect(
      getIfBlockPreviewTitle(
        step('ifThen', {
          parameters: { branchName: 'Department is HR' },
          description: 'Checks if the department field equals HR',
        }),
      ),
    ).toBe('Department is HR')
  })

  it('uses the saved condition once one exists', () => {
    expect(
      getIfBlockPreviewTitle(
        step('ifThen', {
          parameters: {
            branchName: 'Department is HR',
            conditions: [
              {
                rows: [
                  {
                    field: 'Department',
                    is: 'is',
                    condition: 'equals',
                    text: 'HR',
                  },
                ],
              },
            ],
          },
        }),
      ),
    ).toBe('Department is equal to HR')
  })

  it('uses a step variable label in the condition', () => {
    const id = 'step.11111111-1111-4111-8111-111111111111.answer'
    expect(
      getIfBlockPreviewTitle(
        step('ifThen', {
          parameters: {
            conditions: [
              {
                rows: [
                  {
                    field: `{{${id}}}`,
                    is: 'is',
                    condition: 'equals',
                    text: 'HR',
                  },
                ],
              },
            ],
          },
        }),
        (variableId) => (variableId === id ? 'Department' : undefined),
      ),
    ).toBe('Department is equal to HR')
  })

  it('uses the Repeat description until a list is chosen', () => {
    expect(
      getRepeatBlockPreviewTitle(
        step('forEach', { description: 'Loops through each pending case' }),
      ),
    ).toBe('Loops through each pending case')
  })
})
