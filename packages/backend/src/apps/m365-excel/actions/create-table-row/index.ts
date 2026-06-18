import type {
  IGlobalVariable,
  IRawAction,
  RunBatchJobResult,
} from '@plumber/types'

import RetriableError from '@/errors/retriable-error'
import StepError from '@/errors/step'

import { extractAuthDataWithPlumberFolder } from '../../common/auth-data'
import { TEST_STEP_MAX_COLUMNS } from '../../common/constants'
import { validateCanAccessFile } from '../../common/file-privacy'
import { sanitiseInputValue } from '../../common/sanitise-formula-input'
import { constructMsGraphValuesArrayForRowWrite } from '../../common/workbook-helpers/tables'
import WorkbookSession from '../../common/workbook-session'
import { RATE_LIMIT_FOR_RELEASE_ONLY_REMOVE_AFTER_JULY_2024 } from '../../FOR_RELEASE_PERIOD_ONLY'
import batchQueueConfig from '../../queue/batch'

import getDataOutMetadata from './get-data-out-metadata'
import { parametersSchema } from './schemas'

// Small wrapper around constructMsGraphValuesArrayForRowWrite which throws
// StepError. As StepError requires $, this helps avoid $ becoming viral through
// our codebase.
//
// constructMsGraphValuesArrayForRowWrite is a generic helper function and
// should not be restricted to codepaths with $.
function buildRowUpdateArgs(
  $: IGlobalVariable,
  ...args: Parameters<typeof constructMsGraphValuesArrayForRowWrite>
): ReturnType<typeof constructMsGraphValuesArrayForRowWrite> {
  try {
    return constructMsGraphValuesArrayForRowWrite(...args)
  } catch (err) {
    throw new StepError(
      `Error creating table row: ${err.message}`,
      'Double check that your step is configured correctly',
    )
  }
}

interface TableHeaderInfo {
  rowIndex: number
  columnNames: string[] // Ordered
}

// A job whose params parsed cleanly. Collected per job (so a single bad-input
// job is isolated) before the batch's shared access check + write.
type ParsedJob = {
  index: number
  $: IGlobalVariable
  params: ReturnType<typeof parseRowParams>
}

// Parse + validate one job's params, throwing a StepError on bad input.
function parseRowParams($: IGlobalVariable) {
  const parametersParseResult = parametersSchema.safeParse($.step.parameters)
  if (parametersParseResult.success === false) {
    throw new StepError(
      'There was a problem with the input.',
      parametersParseResult.error.issues[0].message,
    )
  }
  return parametersParseResult.data
}

// Performs a single multi-row insert for a batch of createTableRow jobs that
// all target the same file + table. Each job carries its own `$` (its own
// step / params / execution) and gets its own `sheetRowNumber` output.
//
// Per-job isolation: each job's PARAMS are parsed individually, so a single
// bad-input job is excluded (`failed`) while the rest commit. FILE ACCESS is
// authorized ONCE for the whole batch - the batch group key
// (`${fileId}::${tableId}::${connectionId}`) pins every job to one connection +
// file, so a single Graph permission query authorizes them all. A PERMANENT
// denial isolates the entire batch (`failed`); a TRANSIENT access error
// (RetriableError) THROWS so the whole batch retries (see below). The return
// value reports, per input job (aligned by index), whether it committed
// (`success`) or was excluded (`failed`) - so the batch worker can isolate the
// bad jobs while the rest commit. A genuine WRITE failure (the Graph POST
// itself) likewise THROWS, so the whole batch fails all-or-none and is retried
// (nothing was committed).
//
// `run($)` (test runs + the single-job drain path) delegates here with a batch
// of one and re-throws a `failed` result, so the insert logic lives in one
// place and the single-job contract (throw on failure) is preserved.
async function runBatch(
  jobs: Array<{ $: IGlobalVariable }>,
): Promise<RunBatchJobResult[]> {
  // results[i] is the outcome for jobs[i]. Valid jobs are collected for the
  // single shared write; invalid jobs stay `failed` and are never written.
  const results: RunBatchJobResult[] = []

  // Phase 1 - parse each job's params individually, so a single bad-input job is
  // isolated (reported `failed`, excluded from the write) without sinking its
  // batch-mates. forEach is synchronous, so `parsed` is already in batch order.
  const parsed: ParsedJob[] = []
  jobs.forEach(({ $ }, index) => {
    try {
      parsed.push({ index, $, params: parseRowParams($) })
    } catch (error) {
      results[index] = { status: 'failed', error }
    }
  })

  // Every job had bad params: nothing to authorize or write, no Graph call.
  if (parsed.length === 0) {
    return results
  }

  // Group affinity guarantees every job shares one file + table + connection
  // (the batch group key is `${fileId}::${tableId}::${connectionId}`), but
  // assert it defensively over the parsed set: runBatch issues exactly one POST
  // through one WorkbookSession after ONE access check, so a job for a different
  // table would write to the wrong table, and a job for a different access
  // identity would have its rows written under the wrong authorization.
  //
  // We assert EXACTLY what the single validateCanAccessFile call consumes -
  // pipe owner (email) + connection id + the auth data the verdict is computed
  // from (tenantKey + Plumber folderId) - not just the connectionId FK. Two jobs
  // can share a connectionId yet load divergent auth data: each job's `$.auth`
  // is loaded independently during the parallel prepare, so a connection record
  // mutated between those loads could change tenant/folder under a stable id. We
  // read the raw `$.auth.data` here (no parse) so a malformed-auth job is caught
  // by the access check below, not thrown out of the assertion.
  const { fileId, tableId } = parsed[0].params
  const { $: firstJob } = parsed[0]
  const identityOf = ($: IGlobalVariable) =>
    [
      $.user?.email ?? null,
      $.auth?.connectionId ?? null,
      $.auth?.data?.tenantKey ?? null,
      $.auth?.data?.folderId ?? null,
    ].join('\0')
  const firstIdentity = identityOf(firstJob)
  for (const { $, params } of parsed) {
    if (params.fileId !== fileId || params.tableId !== tableId) {
      throw new Error(
        'createTableRow batch contains jobs for different files or tables; ' +
          `expected ${String(fileId)}::${String(tableId)}.`,
      )
    }
    if (identityOf($) !== firstIdentity) {
      throw new Error(
        'createTableRow batch contains jobs with different access identities ' +
          '(connection / user / auth data); the batch group key must pin every ' +
          'job to one connection.',
      )
    }
  }

  // ONE file-access check for the whole batch. validateCanAccessFile's verdict
  // depends only on the access identity asserted above + fileId (never on row
  // data), so a single Graph permission query authorizes the entire batch
  // instead of one query per job.
  //
  // Failure handling splits by cause, because one check now covers the whole
  // batch:
  // - TRANSIENT (Graph 429/5xx/timeout, surfaced as RetriableError by the m365
  //   http interceptor): rethrow so the WHOLE batch retries with the usual
  //   backoff - exactly like a transient WRITE failure. Isolating here would
  //   permanently fail up to a full batch on one blip.
  // - PERMANENT (revoked access / wrong folder / disallowed sensitivity, or any
  //   non-retriable error): isolate EVERY job (reported `failed`, never retried)
  //   since retrying cannot help.
  try {
    await validateCanAccessFile(
      firstJob.user?.email,
      extractAuthDataWithPlumberFolder(firstJob),
      fileId,
      firstJob.http,
    )
  } catch (error) {
    if (error instanceof RetriableError) {
      throw error
    }
    for (const { index } of parsed) {
      results[index] = { status: 'failed', error }
    }
    return results
  }

  // All parsed jobs are authorized: they are the healthy set, already in batch
  // order. Mark each `success` now; the shared write below commits their rows.
  const healthy = parsed
  for (const { index } of healthy) {
    results[index] = { status: 'success' }
  }

  // The whole batch is written through ONE session (the first job's). Every job
  // shares that job's connection (asserted above) and the single check
  // authorized it, so this session's authorization is correct for every row.
  // acquire re-checks access as defensive depth (and it is the sole check on the
  // single-job `run` path).
  const session = await WorkbookSession.acquire(firstJob, fileId as string)

  const tableHeaderInfoResponse = await session.request<{
    rowIndex: number
    values: string[][] // Guaranteed to be length 1 at top level
  }>(`/tables/:tableId/headerRowRange?$select=rowIndex,values`, 'get', {
    urlPathParams: {
      tableId,
    },
  })

  // This occurs when a user selected all the columns and created a table by accident...
  // Reference: https://learn.microsoft.com/en-us/answers/questions/1837007/excel-api-cant-reach-data-on-the-last-column-xfd
  if (!tableHeaderInfoResponse.data.values?.[0]?.length) {
    throw new StepError(
      'Could not read table headers.',
      'Your Excel table may span the maximum number of columns (XFD). Delete unused columns at the end of the table.',
    )
  }

  const tableHeaderInfo: TableHeaderInfo = {
    rowIndex: tableHeaderInfoResponse.data.rowIndex,
    columnNames: tableHeaderInfoResponse.data.values[0],
  }

  // One ordered values row per valid job, in batch order. Note: we disallow
  // blacklisted formulas and sanitise when necessary.
  const values = healthy.map(({ $, params }) =>
    buildRowUpdateArgs(
      $,
      tableHeaderInfo.columnNames,
      params.columnValues.map((col) => ({
        columnName: col.columnName,
        value: sanitiseInputValue(col.value),
      })),
    ),
  )

  const createRowResponse = await session.request<{ index: number }>(
    `/tables/:tableId/rows`,
    'post',
    {
      data: {
        index: null,
        values,
      },
      urlPathParams: {
        tableId,
      },
    },
  )

  // The multi-row response returns a single `index`: the table-index of the
  // FIRST inserted row (Approach A). Rows are inserted contiguously, so the
  // i-th valid job lands at responseStartIndex + i. (Gated by the >=2-row test,
  // and by the per-file lock which guarantees no concurrent appends shift these
  // rows.)
  const responseStartIndex = createRowResponse.data.index

  // Only now that all rows are committed do we set each valid job's own output.
  healthy.forEach(({ $ }, index) => {
    $.setActionItem({
      raw: {
        // `sheetRowNumber` exposes the actual row number of the created row.
        //
        // e.g. if I initially have an empty table with header row at row 10,
        // and I add a row of data, that created row's sheetRowNumber would be
        // 11.
        //
        // tableHeaderInfo.rowIndex contains the 0-indexed row number of the
        // table's _header_ row. It follows that we can compute the sheet row
        // number via:
        //
        //   /* Compute the header's row number ... */
        //   tableHeaderInfo.rowIndex + 1
        //   /* ...and add... */
        //   +
        //   /* ... the new row's index from the header row (1-indexed) */
        //   (responseStartIndex + index) + 1
        sheetRowNumber:
          tableHeaderInfo.rowIndex + 1 + (responseStartIndex + index) + 1,
        success: true,
      },
    })
  })

  return results
}

const action: IRawAction = {
  name: 'Create table row',
  key: 'createTableRow',
  description: 'Creates a new row in your Excel table',
  arguments: [
    {
      key: 'fileId',
      label: 'Excel File',
      required: true,
      description: 'This should be an Excel file in the folder created for you',
      type: 'dropdown' as const,
      showOptionValue: false,
      variables: false,
      source: {
        type: 'query' as const,
        name: 'getDynamicData' as const,
        arguments: [
          {
            name: 'key',
            value: 'listFiles',
          },
        ],
      },
    },
    {
      key: 'tableId',
      label: 'Table',
      required: true,
      type: 'dropdown' as const,
      showOptionValue: false,
      variables: false,
      source: {
        type: 'query' as const,
        name: 'getDynamicData' as const,
        arguments: [
          {
            name: 'key',
            value: 'listTables',
          },
          {
            name: 'parameters.fileId',
            value: '{parameters.fileId}',
          },
        ],
      },
    },
    {
      label: 'New row data',
      key: 'columnValues',
      type: 'multirow-multicol' as const,
      autofillable: true,
      maxAutofillOptions: TEST_STEP_MAX_COLUMNS,
      required: true,
      hiddenIf: {
        fieldKey: 'tableId',
        op: 'is_empty',
      },
      subFields: [
        {
          key: 'columnName' as const,
          type: 'dropdown' as const,
          showOptionValue: false,
          required: true,
          variables: false,
          placeholder: 'Column',
          source: {
            type: 'query' as const,
            name: 'getDynamicData' as const,
            arguments: [
              {
                name: 'key',
                value: 'listTableColumns',
              },
              {
                name: 'parameters.fileId',
                value: '{parameters.fileId}',
              },
              {
                name: 'parameters.tableId',
                value: '{parameters.tableId}',
              },
            ],
          },
          customStyle: { flex: 2 },
        },
        {
          key: 'value' as const,
          type: 'string' as const,
          required: true,
          variables: true,
          placeholder: 'Value',
          customStyle: { flex: 3, minWidth: 0, maxWidth: '60%' },
        },
      ],
    },
  ],

  getDataOutMetadata,

  async run($) {
    if ($.execution.testRun) {
      // FOR RELEASE ONLY TO STEM ANY THUNDERING HERDS; REMOVE AFTER 21 Jul 2024.
      await RATE_LIMIT_FOR_RELEASE_ONLY_REMOVE_AFTER_JULY_2024($.user?.email, $)
    }

    // A test run (or a single-job drain off the old queue) is just a batch of
    // one. All insert logic lives in runBatch so there's one code path; a
    // `failed` result (bad params / revoked access) is re-thrown to preserve the
    // single-job contract (run throws on failure, processAction records it).
    const [result] = await runBatch([{ $ }])
    if (result.status === 'failed') {
      throw result.error
    }
  },

  runBatch,

  // Opt into batch processing: jobs for this action are routed to the m365-excel
  // batch queue and processed via runBatch (one multi-row insert per batch).
  batch: batchQueueConfig,
}

export default action
