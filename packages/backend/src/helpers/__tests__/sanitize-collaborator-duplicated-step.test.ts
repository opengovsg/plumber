import { describe, expect, it } from 'vitest'

import { sanitizeCollaboratorDuplicatedParameters } from '@/helpers/sanitize-collaborator-duplicated-step'

describe('sanitizeCollaboratorDuplicatedParameters', () => {
  it('drops the Excel file, worksheet and table but keeps column mappings', () => {
    const result = sanitizeCollaboratorDuplicatedParameters('m365-excel', {
      fileId: 'file-1',
      worksheetId: 'sheet-1',
      tableId: 'table-1',
      columnsToUpdate: [{ columnName: 'Name', value: '{{step.abc.name}}' }],
    })

    expect(result).toEqual({
      columnsToUpdate: [{ columnName: 'Name', value: '{{step.abc.name}}' }],
    })
  })

  it('drops the Tiles table and clears column IDs but keeps values', () => {
    const result = sanitizeCollaboratorDuplicatedParameters('tiles', {
      tableId: 'table-1',
      rowId: '{{step.abc.rowId}}',
      returnLastRow: true,
      rowData: [{ columnId: 'col-1', cellValue: 'hello', operator: 'set' }],
      filters: [{ columnId: 'col-2', operator: 'equals', value: 'x' }],
    })

    expect(result).toEqual({
      rowId: '{{step.abc.rowId}}',
      returnLastRow: true,
      rowData: [{ columnId: '', cellValue: 'hello', operator: 'set' }],
      filters: [{ columnId: '', operator: 'equals', value: 'x' }],
    })
  })

  it('drops the GatherSG encryption key', () => {
    const result = sanitizeCollaboratorDuplicatedParameters('gathersg', {
      encryptionKey: 'secret',
      caseType: 'type-1',
    })

    expect(result).toEqual({ caseType: 'type-1' })
  })

  it('drops sensitive Custom API headers but keeps the rest', () => {
    const result = sanitizeCollaboratorDuplicatedParameters('custom-api', {
      url: 'https://example.com?q=1',
      customHeaders: [
        { key: 'Authorization', value: 'Bearer abc' },
        { key: ' X-API-Key ', value: '{{step.abc.key}}' },
        { key: 'Content-Type', value: 'application/json' },
      ],
    })

    expect(result).toEqual({
      url: 'https://example.com?q=1',
      customHeaders: [{ key: 'Content-Type', value: 'application/json' }],
    })
  })

  it('leaves other apps unchanged', () => {
    const parameters = { channel: 'C123', message: 'hi' }

    expect(sanitizeCollaboratorDuplicatedParameters('slack', parameters)).toBe(
      parameters,
    )
    expect(sanitizeCollaboratorDuplicatedParameters(null, parameters)).toBe(
      parameters,
    )
  })
})
