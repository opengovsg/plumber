import { assert, beforeEach, describe, it } from 'vitest'

import {
  generalisedModelSchema,
  specificModelSchema,
} from '../../common/schema'

describe('AISAY schema', () => {
  let generalisedModelPayload: Record<string, unknown>
  let specificModelPayload: Record<string, unknown>

  beforeEach(() => {
    generalisedModelPayload = {
      file: 's3:plumber-test-bucket:123456/789abc/plumber-logo.jpg',
      prompts: [
        {
          prompt: 'What is your name?',
        },
        {
          prompt: 'What is your age?',
        },
      ],
    }

    specificModelPayload = {
      file: 's3:plumber-test-bucket:123456/789abc/plumber-logo.jpg',
      documentType: 'BANK_STATEMENT',
    }
  })

  describe('generalised model schema', () => {
    it('should validate generalised model schema', () => {
      const result = generalisedModelSchema.safeParse(generalisedModelPayload)
      assert(result.success === true)
      assert(
        result.data.file ===
          's3:plumber-test-bucket:123456/789abc/plumber-logo.jpg',
      )
      assert(Object.keys(result.data.prompts).length === 2)
      assert(
        result.data.prompts['additionalProp0'].description ===
          'Extract the What is your name?',
      )
      assert(
        result.data.prompts['additionalProp1'].description ===
          'Extract the What is your age?',
      )
    })

    it('should fail if file is not a valid S3 ID', () => {
      generalisedModelPayload.file = '123'
      const result = generalisedModelSchema.safeParse(generalisedModelPayload)
      assert(result.success === false)
    })
  })

  describe('specific model schema', () => {
    it('should validate specific model schema', () => {
      const result = specificModelSchema.safeParse(specificModelPayload)
      assert(result.success === true)
    })

    it.each(['BANK_STATEMENT', 'CHEQUE', 'INVOICE', 'PASSPORT', 'RECEIPT'])(
      `should validate for valid document type: %s`,
      (documentType) => {
        specificModelPayload.documentType = documentType
        const result = specificModelSchema.safeParse(specificModelPayload)
        assert(result.success === true)
      },
    )

    it('should fail if document type is not a valid document type', () => {
      specificModelPayload.documentType = 'INVALID_DOCUMENT_TYPE'
      const result = specificModelSchema.safeParse(specificModelPayload)
      assert(result.success === false)
    })
  })
})
