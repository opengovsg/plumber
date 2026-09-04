import { type IGlobalVariable } from '@plumber/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import StepError from '@/errors/step'

const mocks = vi.hoisted(() => ({
  setActionItem: vi.fn(),
  generateObject: vi.fn(),
  getImageContent: vi.fn(),
}))

vi.mock('@/helpers/pair', () => ({
  engineProvider: {
    chat: vi.fn().mockReturnValue({}),
  },
}))

vi.mock('ai', () => ({
  generateObject: mocks.generateObject,
}))

vi.mock('@/apps/pair/common/get-image-content', () => ({
  getImageContent: mocks.getImageContent,
}))

import processImageAction from '@/apps/pair/actions/process-image'

const responseFields = [
  {
    fieldName: 'Signature present',
    description: 'Whether the image contains a handwritten signature',
  },
  {
    fieldName: 'Document type',
    description: 'Type of document in the image',
  },
]

describe('Process image action', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      user: { email: 'user@open.gov.sg' },
      flow: { id: 'flow-id' },
      step: {
        id: 'step-id',
        appKey: 'pair',
        key: processImageAction.key,
        parameters: {},
      },
      execution: { id: 'execution-id', testRun: false },
      setActionItem: mocks.setActionItem,
    } as unknown as IGlobalVariable
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('fails by default when no image is provided', async () => {
    $.step.parameters = {
      image: [],
      responseFields,
    }

    await expect(processImageAction.run($)).rejects.toThrowError(StepError)
    expect(mocks.generateObject).not.toHaveBeenCalled()
    expect(mocks.getImageContent).not.toHaveBeenCalled()
  })

  it('fails when continueIfNoFile is false and no image is provided', async () => {
    $.step.parameters = {
      image: [''],
      continueIfNoFile: false,
      responseFields,
    }

    await expect(processImageAction.run($)).rejects.toThrowError(StepError)
    expect(mocks.generateObject).not.toHaveBeenCalled()
  })

  it('continues with blank outputs when continueIfNoFile is true and no image is provided', async () => {
    $.step.parameters = {
      image: [],
      continueIfNoFile: true,
      responseFields,
    }

    await processImageAction.run($)

    expect(mocks.generateObject).not.toHaveBeenCalled()
    expect(mocks.getImageContent).not.toHaveBeenCalled()
    expect(mocks.setActionItem).toHaveBeenCalledWith({
      raw: {
        Signature_present: '',
        Document_type: '',
      },
    })
  })

  it('continues with blank outputs when continueIfNoFile is true and the image value is blank', async () => {
    $.step.parameters = {
      image: [''],
      continueIfNoFile: true,
      responseFields,
    }

    await processImageAction.run($)

    expect(mocks.generateObject).not.toHaveBeenCalled()
    expect(mocks.setActionItem).toHaveBeenCalledWith({
      raw: {
        Signature_present: '',
        Document_type: '',
      },
    })
  })

  it('still processes the image when continueIfNoFile is true and an image is provided', async () => {
    mocks.getImageContent.mockResolvedValue([{ type: 'image', image: 'data' }])
    mocks.generateObject.mockResolvedValue({
      object: {
        Signature_present: 'yes',
        Document_type: 'invoice',
      },
    })

    $.step.parameters = {
      image: ['s3-id-123'],
      continueIfNoFile: true,
      responseFields,
    }

    await processImageAction.run($)

    expect(mocks.getImageContent).toHaveBeenCalledWith('s3-id-123')
    expect(mocks.generateObject).toHaveBeenCalled()
    expect(mocks.setActionItem).toHaveBeenCalledWith({
      raw: {
        Signature_present: 'yes',
        Document_type: 'invoice',
      },
    })
  })
})
