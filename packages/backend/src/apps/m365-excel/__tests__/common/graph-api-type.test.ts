import { describe, expect, it } from 'vitest'

import {
  getLastHitGraphApiType,
  GraphApiType,
} from '../../common/graph-api-type'

describe('Graph API type', () => {
  describe('getLastHitGraphApiType', () => {
    it.each([
      '/v1.0/sites/SITE123/drive/items/FILE123/workbook/tables/headerRowRange/$select=count',
      '/v1.0/sites/SITE123/drive/items/FILE123/workbook/sheets',
      '/beta/sites/SITE123/drive/items/FILE123/workbook/tables/headerRowRange',
      'https://graph.microsoft.com/v1.0/sites/SITE123/drive/items/FILE123/workbook/tables/headerRowRange',
    ])('recognizes Excel endpoints', (url) => {
      expect(getLastHitGraphApiType(url)).toEqual(GraphApiType.Excel)
    })

    it.each([
      '/v1.0/sites/SITE123/drive/items/FILE123/?select=sensitivityLabel',
      '/v1.0/sites/SITE123/drive/items/FILE123/permissions',
      'https://graph.microsoft.com/v1.0/sites/SITE123/drive/items/FILE123/?select=sensitivityLabel',
    ])('recognizes SharePoint endpoints', (url) => {
      expect(getLastHitGraphApiType(url)).toEqual(GraphApiType.SharePoint)
    })

    it.each(['/v1.0/auth', '/v1.0/me', 'https://graph.microsoft.com/v1.0/me'])(
      'classifies other endpoints as others',
      (url) => {
        expect(getLastHitGraphApiType(url)).toEqual(GraphApiType.Others)
      },
    )
  })
})
