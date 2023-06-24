import { IExecutionStep } from '@plumber/types'

import { describe, expect, it } from 'vitest'

import getDataOutMetadata from '../../metadata/get-data-out-metadata'
import newSubmissionTrigger from '../../triggers/new-submission'

const SAMPLE_EXECUTION_STEP = {
  dataOut: {
    fields: {
      textFieldId: {
        question: 'What is your name?',
        answer: 'herp derp',
        fieldType: 'textField',
      },
    },
  },
} as unknown as IExecutionStep

describe('formsg data-out metadata', () => {
  it('is null if step is not new submission', async () => {
    const metadata = await getDataOutMetadata(
      'herp derp',
      SAMPLE_EXECUTION_STEP,
    )
    expect(metadata).toBeNull()
  })

  it('hides the question and field type', async () => {
    const metadata = await getDataOutMetadata(
      newSubmissionTrigger.key,
      SAMPLE_EXECUTION_STEP,
    )

    expect(metadata.fields.textFieldId.question.isVisible).toEqual(false)
    expect(metadata.fields.textFieldId.fieldType.isVisible).toEqual(false)
  })

  it('changes the answer label to include the question', async () => {
    const metadata = await getDataOutMetadata(
      newSubmissionTrigger.key,
      SAMPLE_EXECUTION_STEP,
    )

    expect(metadata.fields.textFieldId.answer.label).toEqual(
      `Answer (What is your name?)`,
    )
  })
})
