import { IDataOutMetadatum, IExecutionStep, IJSONObject } from '@plumber/types'

import { beforeEach, describe, expect, it } from 'vitest'

import getDataOutMetadata from '../../metadata/get-data-out-metadata'
import newSubmissionTrigger from '../../triggers/new-submission'

describe('formsg dataOut metadata', () => {
  let executionStep: IExecutionStep

  beforeEach(() => {
    executionStep = {
      dataOut: {
        fields: {
          textFieldId: {
            question: 'What is your name?',
            answer: 'herp derp',
            fieldType: 'textField',
            questionNumber: 1,
          },
        },
      },
    } as unknown as IExecutionStep
  })

  it('only processes new submission triggers', async () => {
    const metadata = await getDataOutMetadata(
      'some other trigger',
      executionStep,
    )
    expect(metadata).toBeNull()
  })

  it('ensures that only question and answer props are visible', async () => {
    const metadata = await getDataOutMetadata(
      newSubmissionTrigger.key,
      executionStep,
    )

    for (const [propName, data] of Object.entries(
      metadata.fields.textFieldId,
    )) {
      expect((data as IDataOutMetadatum).isVisible).toEqual(
        ['question', 'answer'].includes(propName),
      )
    }
  })

  it('changes the question label to "Question #n"', async () => {
    const metadata = await getDataOutMetadata(
      newSubmissionTrigger.key,
      executionStep,
    )

    expect(metadata.fields.textFieldId.question.label).toEqual('Question 1')
  })

  it('changes the answer label to "Response #n"', async () => {
    const metadata = await getDataOutMetadata(
      newSubmissionTrigger.key,
      executionStep,
    )

    expect(metadata.fields.textFieldId.answer.label).toEqual('Response 1')
  })

  it('positions the answer after the question', async () => {
    const metadata = await getDataOutMetadata(
      newSubmissionTrigger.key,
      executionStep,
    )

    expect(metadata.fields.textFieldId.question.renderPosition).toBeLessThan(
      metadata.fields.textFieldId.answer.renderPosition,
    )
  })

  it('sets label and renderPosition to null if question number is undefined', async () => {
    // Not inline because prettier barfs on this.
    const fields = executionStep.dataOut.fields as IJSONObject
    fields.textFieldId = {
      question: 'What is your name?',
      answer: 'herp derp',
      fieldType: 'textField',
    }

    const metadata = await getDataOutMetadata(
      newSubmissionTrigger.key,
      executionStep,
    )

    expect(metadata.fields.textFieldId.question.renderPosition).toBeNull()
    expect(metadata.fields.textFieldId.answer.renderPosition).toBeNull()
    expect(metadata.fields.textFieldId.question.label).toBeNull()
    expect(metadata.fields.textFieldId.answer.label).toBeNull()
  })
})
