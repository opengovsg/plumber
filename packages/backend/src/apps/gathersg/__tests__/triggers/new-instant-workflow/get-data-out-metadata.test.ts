import { describe, expect, it } from 'vitest'

import { HEX_ENCODED_FIELD_PREFIX } from '../../../common/constants'
import getDataOutMetadata from '../../../triggers/new-instant-workflow/get-data-out-metadata'

const DEFAULT_CASE_DATA = {
  app: 'plumber-test',
  signature: 'sig123',
  timestamp: new Date().getTime(),
}

describe('getDataOutMetadata', () => {
  it('should return null if dataOut is missing', async () => {
    const executionStep = {
      dataOut: null,
    }

    const result = await getDataOutMetadata(executionStep)
    expect(result).toBeNull()
  })

  it('should return null if dataOut schema validation fails', async () => {
    const executionStep = {
      dataOut: {
        invalid: 'data',
      },
    }

    const result = await getDataOutMetadata(executionStep)
    expect(result).toBeNull()
  })

  it('should create basic case metadata', async () => {
    const executionStep = {
      dataOut: {
        ...DEFAULT_CASE_DATA,
        data: {
          caseRef: 'CASE-001',
          createdAt: '2024-01-01',
          status: 'open',
          type: 'inquiry',
          updatedAt: '2024-01-02',
          uuid: 'abc123',
        },
      },
    }

    const result = await getDataOutMetadata(executionStep)

    expect(result).toBeDefined()
    expect(result?.app).toEqual({ label: 'App' })
    expect(result?.signature).toEqual({ isHidden: true })
    expect(result?.timestamp).toEqual({ label: 'Timestamp' })
    expect(result?.data.caseRef).toEqual({ label: 'Case ref' })
    expect(result?.data.status).toEqual({ label: 'Status' })
  })

  describe('Optional nested objects', () => {
    it('should hide formsg metadata when formsg is absent', async () => {
      const executionStep = {
        dataOut: {
          ...DEFAULT_CASE_DATA,
          data: {
            caseRef: 'CASE-001',
          },
        },
      }

      const result = await getDataOutMetadata(executionStep)
      expect(result?.data.formsg).toEqual({ isHidden: true })
    })

    it('should show formsg metadata when formsg is present', async () => {
      const executionStep = {
        dataOut: {
          ...DEFAULT_CASE_DATA,
          data: {
            caseRef: 'CASE-001',
            formsg: {
              formId: 'form123',
              submissionId: 'sub456',
            },
          },
        },
      }

      const result = await getDataOutMetadata(executionStep)
      expect(result?.data.formsg).toEqual({
        formId: { label: 'FormSG (form ID)' },
        submissionId: { label: 'FormSG (submission ID)' },
      })
    })

    it('should hide createdBy metadata when createdBy is absent', async () => {
      const executionStep = {
        dataOut: {
          ...DEFAULT_CASE_DATA,
          data: {
            caseRef: 'CASE-001',
          },
        },
      }

      const result = await getDataOutMetadata(executionStep)
      expect(result?.data.createdBy).toEqual({ isHidden: true })
    })

    it('should show createdBy metadata when createdBy is present', async () => {
      const executionStep = {
        dataOut: {
          ...DEFAULT_CASE_DATA,
          data: {
            caseRef: 'CASE-001',
            createdBy: {
              email: 'creator@example.com',
              name: 'Creator',
            },
          },
        },
      }

      const result = await getDataOutMetadata(executionStep)
      expect(result?.data.createdBy).toEqual({
        email: { label: 'Created by (email)' },
        name: { label: 'Created by (name)' },
      })
    })

    it('should hide updatedBy metadata when updatedBy is absent', async () => {
      const executionStep = {
        dataOut: {
          ...DEFAULT_CASE_DATA,
          data: {
            caseRef: 'CASE-001',
          },
        },
      } as any

      const result = await getDataOutMetadata(executionStep)
      expect(result?.data.updatedBy).toEqual({ isHidden: true })
    })

    it('should show updatedBy metadata when updatedBy is present', async () => {
      const executionStep = {
        dataOut: {
          ...DEFAULT_CASE_DATA,
          data: {
            caseRef: 'CASE-001',
            updatedBy: {
              email: 'updater@example.com',
              name: 'Updater',
            },
          },
        },
      }

      const result = await getDataOutMetadata(executionStep)
      expect(result?.data.updatedBy).toEqual({
        email: { label: 'Updated by (email)' },
        name: { label: 'Updated by (name)' },
      })
    })

    it('should hide finalisedBy metadata when finalisedBy is absent', async () => {
      const executionStep = {
        dataOut: {
          ...DEFAULT_CASE_DATA,
          data: {
            caseRef: 'CASE-001',
          },
        },
      }

      const result = await getDataOutMetadata(executionStep)
      expect(result?.data.finalisedBy).toEqual({ isHidden: true })
    })

    it('should show finalisedBy metadata when finalisedBy is present', async () => {
      const executionStep = {
        dataOut: {
          ...DEFAULT_CASE_DATA,
          data: {
            caseRef: 'CASE-001',
            finalisedBy: {
              email: 'finaliser@example.com',
              name: 'Finaliser',
            },
          },
        },
      }

      const result = await getDataOutMetadata(executionStep)
      expect(result?.data.finalisedBy).toEqual({
        email: { label: 'Finalised by (email)' },
        name: { label: 'Finalised by (name)' },
      })
    })
  })

  describe('Attachments', () => {
    it('should create hidden metadata for attachments', async () => {
      const executionStep = {
        dataOut: {
          ...DEFAULT_CASE_DATA,
          data: {
            caseRef: 'CASE-001',
            attachments: {
              attach1: {
                name: 'file1.pdf',
                mimeType: 'application/pdf',
                size: 1024,
              },
              attach2: {
                name: 'file2.jpg',
                mimeType: 'image/jpeg',
                size: 2048,
              },
            },
          },
        },
      }

      const result = await getDataOutMetadata(executionStep)

      expect(result?.data.attachments).toEqual({
        attach1: {
          name: { isHidden: true },
          mimeType: { isHidden: true },
          size: { isHidden: true },
        },
        attach2: {
          name: { isHidden: true },
          mimeType: { isHidden: true },
          size: { isHidden: true },
        },
      })
    })
  })

  describe('Fields - Hex encoding', () => {
    it('should decode hex-encoded field names', async () => {
      const fieldName = 'field.with/special@chars'
      const hexEncodedKey = `${HEX_ENCODED_FIELD_PREFIX}${Buffer.from(
        fieldName,
      ).toString('hex')}`

      const executionStep = {
        dataOut: {
          ...DEFAULT_CASE_DATA,
          data: {
            caseRef: 'CASE-001',
            fields: {
              [hexEncodedKey]: 'some value',
            },
          },
        },
      }

      const result = await getDataOutMetadata(executionStep)

      expect(result?.data.fields[hexEncodedKey]).toEqual({
        label: fieldName,
      })
    })

    it('should use key as-is for non-hex-encoded fields', async () => {
      const executionStep = {
        dataOut: {
          ...DEFAULT_CASE_DATA,
          data: {
            caseRef: 'CASE-001',
            fields: {
              normalField: 'some value',
            },
          },
        },
      }

      const result = await getDataOutMetadata(executionStep)

      expect(result?.data.fields.normalField).toEqual({
        label: 'normalField',
      })
    })

    it('should handle invalid hex encoding gracefully', async () => {
      const invalidHexKey = `${HEX_ENCODED_FIELD_PREFIX}zzz`

      const executionStep = {
        dataOut: {
          ...DEFAULT_CASE_DATA,
          data: {
            caseRef: 'CASE-001',
            fields: {
              [invalidHexKey]: 'some value',
            },
          },
        },
      }

      const result = await getDataOutMetadata(executionStep)

      // Should fall back to using the key as label
      expect(result?.data.fields[invalidHexKey]).toEqual({
        label: invalidHexKey,
      })
    })
  })

  describe('Fields - Simple fields', () => {
    it('should create metadata for simple text field', async () => {
      const executionStep = {
        dataOut: {
          ...DEFAULT_CASE_DATA,
          data: {
            caseRef: 'CASE-001',
            fields: {
              name: 'John Doe',
              email: 'john@example.com',
            },
          },
        },
      }

      const result = await getDataOutMetadata(executionStep)

      expect(result?.data.fields.name).toEqual({ label: 'name' })
      expect(result?.data.fields.email).toEqual({ label: 'email' })
    })
  })

  describe('Fields - Primitive arrays with _array property', () => {
    it('should create metadata for primitive array with _array property', async () => {
      const executionStep = {
        dataOut: {
          ...DEFAULT_CASE_DATA,
          data: {
            caseRef: 'CASE-001',
            fields: {
              colors: {
                0: 'red',
                1: 'blue',
                2: 'green',
                _array: ['red', 'blue', 'green'],
              },
            },
          },
        },
      }

      const result = await getDataOutMetadata(executionStep)

      expect(result?.data.fields.colors).toEqual({
        0: { type: 'text', label: 'colors' },
        1: { type: 'text', label: 'colors' },
        2: { type: 'text', label: 'colors' },
        _array: {
          label: 'colors',
          type: 'array',
          displayedValue: 'red, blue, green',
        },
      })
    })

    it('should hide primitive array when it contains only attachment keys', async () => {
      const executionStep = {
        dataOut: {
          ...DEFAULT_CASE_DATA,
          data: {
            caseRef: 'CASE-001',
            attachments: {
              attach1: {
                name: 'file1.pdf',
                mimeType: 'application/pdf',
                size: 1024,
              },
              attach2: {
                name: 'file2.pdf',
                mimeType: 'application/pdf',
                size: 1024,
              },
            },
            fields: {
              documents: {
                0: 'attach1',
                1: 'attach2',
                _array: ['attach1', 'attach2'],
              },
            },
          },
        },
      }

      const result = await getDataOutMetadata(executionStep)

      expect(result?.data.fields.documents).toEqual({
        label: 'documents',
        isHidden: true,
      })
    })
  })

  describe('Fields - Direct arrays', () => {
    it('should create metadata for primitive array (non-_array format)', async () => {
      const executionStep = {
        dataOut: {
          ...DEFAULT_CASE_DATA,
          data: {
            caseRef: 'CASE-001',
            fields: {
              tags: ['urgent', 'follow-up', 'resolved'],
            },
          },
        },
      }

      const result = await getDataOutMetadata(executionStep)

      expect(result?.data.fields.tags).toEqual([
        { type: 'text', label: 'tags 1' },
        { type: 'text', label: 'tags 2' },
        { type: 'text', label: 'tags 3' },
      ])
    })

    it('should hide direct array when it contains only attachment keys', async () => {
      const executionStep = {
        dataOut: {
          ...DEFAULT_CASE_DATA,
          data: {
            caseRef: 'CASE-001',
            attachments: {
              attach1: {
                name: 'file1.pdf',
                mimeType: 'application/pdf',
                size: 1024,
              },
              attach2: {
                name: 'file2.pdf',
                mimeType: 'application/pdf',
                size: 1024,
              },
            },
            fields: {
              files: ['attach1', 'attach2'],
            },
          },
        },
      }

      const result = await getDataOutMetadata(executionStep)

      expect(result?.data.fields.files).toEqual({
        label: 'files',
        isHidden: true,
      })
    })

    it('should create metadata for array of objects', async () => {
      const executionStep = {
        dataOut: {
          ...DEFAULT_CASE_DATA,
          data: {
            caseRef: 'CASE-001',
            fields: {
              items: [
                { name: 'Item 1', quantity: 5 },
                { name: 'Item 2', quantity: 10 },
              ],
            },
          },
        },
      }

      const result = await getDataOutMetadata(executionStep)

      expect(result?.data.fields.items).toEqual({
        0: {
          name: { type: 'text', label: 'items Row 1 name' },
          quantity: { type: 'text', label: 'items Row 1 quantity' },
        },
        1: {
          name: { type: 'text', label: 'items Row 2 name' },
          quantity: { type: 'text', label: 'items Row 2 quantity' },
        },
      })
    })

    it('should handle empty array of objects', async () => {
      const executionStep = {
        dataOut: {
          ...DEFAULT_CASE_DATA,
          data: {
            caseRef: 'CASE-001',
            fields: {
              items: [],
            },
          },
        },
      }

      const result = await getDataOutMetadata(executionStep)

      expect(result?.data.fields.items).toEqual([])
    })
  })

  // describe('Integration - Complex case', () => {
  //   it('should handle complex dataOut with all field types', async () => {
  //     const hexEncodedField = `${HEX_ENCODED_FIELD_PREFIX}${Buffer.from(
  //       'field.special',
  //     ).toString('hex')}`

  //     const executionStep = {
  //       dataOut: {
  //         data: {
  //           caseRef: 'CASE-001',
  //           createdAt: '2024-01-01',
  //           status: 'open',
  //           type: 'inquiry',
  //           formsg: {
  //             formId: 'form123',
  //             submissionId: 'sub456',
  //           },
  //           createdBy: {
  //             email: 'creator@example.com',
  //             name: 'Creator',
  //           },
  //           attachments: {
  //             attach1: {
  //               name: 'file1.pdf',
  //               mimeType: 'application/pdf',
  //               size: 1024,
  //             },
  //           },
  //           fields: {
  //             name: 'John Doe',
  //             [hexEncodedField]: 'special value',
  //             colors: {
  //               0: 'red',
  //               1: 'blue',
  //               _array: ['red', 'blue'],
  //             },
  //             tags: ['urgent', 'follow-up'],
  //             items: [
  //               { name: 'Item 1', qty: 5 },
  //               { name: 'Item 2', qty: 10 },
  //             ],
  //             attachmentRefs: ['attach1'],
  //           },
  //         },
  //         app: 'gathersg',
  //         signature: 'sig123',
  //         timestamp: '2024-01-01T00:00:00Z',
  //       },
  //     } as any

  //     const result = await getDataOutMetadata(executionStep)

  //     expect(result).toBeDefined()
  //     expect(result?.data.formsg).toEqual({
  //       formId: { label: 'FormSG (form ID)' },
  //       submissionId: { label: 'FormSG (submission ID)' },
  //     })
  //     expect(result?.data.createdBy).toEqual({
  //       email: { label: 'Created by (email)' },
  //       name: { label: 'Created by (name)' },
  //     })
  //     expect(result?.data.fields.name).toEqual({ label: 'name' })
  //     expect(result?.data.fields[hexEncodedField]).toEqual({
  //       label: 'field.special',
  //     })
  //     expect(result?.data.fields.attachmentRefs).toEqual({
  //       label: 'attachmentRefs',
  //       isHidden: true,
  //     })
  //   })
  // })
})
