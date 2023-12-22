import type { IGlobalVariable } from '@plumber/types'

import { M365TenantInfo } from '@/config/app-env-vars/m365'

import { RedisCachedValue } from '../../redis-cached-value'

import {
  initCachedTableColumns,
  initCachedTables,
  initCachedWorksheets,
} from './cached-values'
import {
  type ExcelTable,
  type ExcelTableColumn,
  type ExcelWorksheet,
} from './constants'

/**
 * A small abstraction to make it easier to fetch, cache and manipulate excel
 * files.
 * ===
 *
 * This class allows users to:
 * 1. (TODO) Ensure that a file is not too sensitive before working on it.
 * 2. Query (with automatic caching) _infrequently_ changed data such as
 *    worksheets, tables and table columns.
 * 3. (TODO) Spin up sessions to safely manipulate excel data in a concurrent
 *    environment.
 *
 * Some design notes:
 * a) _For now_, it doesn't do smart things like invalidating a table cached
 *    if that table is changed (there's no concept of data relations).
 *
 * b) This caches each bit of excel data (e.g. table columns, worksheets, etc)
 *    in separate redis keys instead of inside a redis hash with different
 *    fields.
 *
 *    This is because:
 *    1. Redis does not support individual field expiration inside a hash; if
 *       the hash expires, all its fields expire.
 *    2. M365's API has a very "piecewise" design in that different endpoints
 *       are used to fetch different bits of data (e.g. excel worksheets has its
 *       own endpoint, excel tables has its own endpoint). Thus, populating a
 *       hash field typically requires a new query.
 *
 *    If we store data in a hash, these 2 reasons will make us prematurely expire
 *    data and cause extra unneeded queries. For example:
 *
 *    1. Suppose expiry is set to 10 minutes.
 *    2. At minute 0, we query the file's filename and ID, and create the
 *       initial redis hash for the file.
 *    3. At minute 8, we query and store table data inside a "tables" field in
 *       the above redis hash.
 *    4. At minute 10, the hash expires, and redis wipes the hash; this wipes
 *       the filename, file ID and table data.
 *    5. At minute 12, the user tries to get table data. We are forced to make a
 *       query to M365.
 *
 *    If we had stored the table data in a separate redis key, it would have
 *    lived until minute 18, which would have allowed us to avoid making the query
 *    in step 5.
 *
 *    So the most logical thing to do is to store the data in separate keys, at
 *    the cost of data staleness (which doesn't matter _that_ much due to the
 *    short expiry).
 *
 * c) Data is cached (DEFAULT_CACHE_LIFETIME_SECONDS) for quite a long time; the
 *    long TTL is because this _only_ caches data we don't expect to frequently
 *    change. For example, any change in table column names would likely lead to
 *    a user updating their pipe; when they do this, they can invalidate our
 *    cache manually (manual invalidation TODO in later PR).
 */
export class ExcelWorkbook {
  private $: IGlobalVariable
  private tenant: M365TenantInfo
  private fileId: string

  private worksheets: RedisCachedValue<ExcelWorksheet[]>
  private tables: RedisCachedValue<ExcelTable[]>
  private tableColumns: Map<string, RedisCachedValue<ExcelTableColumn[]>>

  public constructor(
    $: IGlobalVariable,
    tenant: M365TenantInfo,
    fileId: string,
  ) {
    this.$ = $
    this.tenant = tenant
    this.fileId = fileId

    this.tables = initCachedTables($, tenant, fileId)
    this.worksheets = initCachedWorksheets($, tenant, fileId)
    this.tableColumns = new Map()
  }

  public async getTables(forceInvalidation = false): Promise<ExcelTable[]> {
    return await this.tables.get(forceInvalidation)
  }

  public async getWorksheets(
    forceInvalidation = false,
  ): Promise<ExcelWorksheet[]> {
    return await this.worksheets.get(forceInvalidation)
  }

  public async getTableColumns(
    tableId: ExcelTable['id'],
    forceInvalidation = false,
  ): Promise<ExcelTableColumn[]> {
    if (!this.tableColumns.has(tableId)) {
      this.tableColumns.set(
        tableId,
        initCachedTableColumns(this.$, this.tenant, this.fileId, tableId),
      )
    }

    return await this.tableColumns.get(tableId).get(forceInvalidation)
  }
}
