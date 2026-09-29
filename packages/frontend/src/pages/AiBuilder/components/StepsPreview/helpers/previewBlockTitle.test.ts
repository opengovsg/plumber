import { describe, expect, it } from 'vitest'

import {
  getIfBlockPreviewTitle,
  getRepeatBlockPreviewTitle,
} from './previewBlockTitle'
import type { PreviewStep } from './previewItems'

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

describe('getIfBlockPreviewTitle', () => {
  it('uses the branch name before a condition is saved', () => {
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
})

describe('getRepeatBlockPreviewTitle', () => {
  it('uses the proposal description before a list is chosen', () => {
    expect(
      getRepeatBlockPreviewTitle(
        step('forEach', { description: 'Loops through each pending case' }),
      ),
    ).toBe('Loops through each pending case')
  })
})
