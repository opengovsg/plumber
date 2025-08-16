import type { IGlobalVariable } from '@plumber/types'

import StepError from '@/errors/step'
import {
  generateErrorForActionOutput,
  ProcessedJobData,
} from '@/services/batch-action'
import { JobProgress } from '@/workers/helpers/make-action-worker'

import { sanitiseInputValue } from '../../common/sanitise-formula-input'
import { validateDynamicFieldsAndThrowError } from '../../common/validate-dynamic-fields'
import { constructMsGraphValuesArrayForRowWrite } from '../../common/workbook-helpers/tables'
import WorkbookSession from '../../common/workbook-session'

import { parametersSchema } from './schemas'

type ColumnValue = {
  columnName: string
  value: string
}

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
      $.step.position,
      $.app.name,
    )
  }
}

interface TableHeaderInfo {
  rowIndex: number
  columnNames: string[] // Ordered
}

async function batchRun(jobsToProcessData: ProcessedJobData[]) {
  const remainingJobsToProcessData = []
  for (const jobToProcessData of jobsToProcessData) {
    const { $, job } = jobToProcessData
    try {
      const parametersParseResult = parametersSchema.safeParse(
        $.step.parameters,
      )

      if (parametersParseResult.success === false) {
        throw new StepError(
          'There was a problem with the input.',
          parametersParseResult.error.issues[0].message,
          $.step?.position,
          $.app.name,
        )
      }

      const { fileId, tableId } = parametersParseResult.data

      // Validation to prevent path traversals
      validateDynamicFieldsAndThrowError({
        fileId,
        tableId,
        $,
      })

      remainingJobsToProcessData.push(jobToProcessData)
    } catch (error) {
      // TODO: check whether to log error with the batch job timestamp
      $.actionOutput.error = generateErrorForActionOutput(error)
      $.setExecutionError(error)
      const newJobProgressData = {
        ...(job.progress as JobProgress).jobProgressData,
        $: $,
      }
      job.updateProgress({
        jobProgressData: newJobProgressData,
      })
      continue
    }
  }

  // acquire just one session for 1 batch API call
  const { fileId, tableId } = remainingJobsToProcessData[0].$.step.parameters

  const session = await WorkbookSession.acquire(
    remainingJobsToProcessData[0].$,
    fileId as string,
  )

  /**
   * Caveat: We cannot tell if any job in the batch would have invalid data for row creation in the batch API call, so refer to they batch-run-hybrid for the logic to fallback to individaul row creation if the batch call fails
   */
  try {
    const tableHeaderInfoResponse = await session.request<{
      rowIndex: number
      values: string[][] // Guaranteed to be length 1 at top level
    }>(`/tables/${tableId}/headerRowRange?$select=rowIndex,values`, 'get')
    const tableHeaderInfo: TableHeaderInfo = {
      rowIndex: tableHeaderInfoResponse.data.rowIndex,
      columnNames: tableHeaderInfoResponse.data.values[0],
    }

    // Note: we disallow blacklisted formulas and sanitise when necessary
    const createRowsResponse = await session.request<{ index: number }>(
      `/tables/${tableId}/rows`,
      'post',
      {
        data: {
          index: null,
          values: remainingJobsToProcessData.map((jobToProcessData) =>
            buildRowUpdateArgs(
              jobToProcessData.$,
              tableHeaderInfo.columnNames,
              (
                jobToProcessData.$.step.parameters.columnValues as ColumnValue[]
              ).map((col) => ({
                columnName: col.columnName,
                value: sanitiseInputValue(col.value),
              })),
            ),
          ),
        },
      },
    )

    // TODO: use zod to parse the createRowsResponse.data
    const createRowsResponseData = createRowsResponse.data as any
    const firstRowIndex =
      tableHeaderInfoResponse.data.rowIndex + 1 + createRowsResponseData.index

    // reconsolidate the data for each job
    for (let i = 0; i < remainingJobsToProcessData.length; i++) {
      const jobToProcessData = remainingJobsToProcessData[i]
      const { $, job } = jobToProcessData
      const sheetRowNumber = firstRowIndex + i + 1
      $.setActionItem({
        raw: {
          sheetRowNumber: sheetRowNumber,
          success: true,
        },
      })
      const newJobProgressData = {
        ...(job.progress as JobProgress).jobProgressData,
        $: $,
      }
      job.updateProgress({
        jobProgressData: newJobProgressData,
      })
    }
  } catch (error) {
    // If the batch function fails because of the first job, only update the first job's progress and clear the rest to be processed again
    const firstJobToProcessData = remainingJobsToProcessData[0]
    const { $, job } = firstJobToProcessData
    $.actionOutput.error = generateErrorForActionOutput(error)
    $.setExecutionError(error)
    const newJobProgressData = {
      ...(job.progress as JobProgress).jobProgressData,
      $: $,
    }
    job.updateProgress({
      jobProgressData: newJobProgressData,
    })

    for (let i = 1; i < remainingJobsToProcessData.length; i++) {
      const jobToProcessData = remainingJobsToProcessData[i]
      const { job } = jobToProcessData
      job.updateProgress(0)
    }
  }
}

export default batchRun
