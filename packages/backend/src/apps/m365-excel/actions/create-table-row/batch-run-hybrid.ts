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

async function createRowsIndividually(
  session: WorkbookSession,
  tableId: string,
  tableHeaderInfo: TableHeaderInfo,
  remainingJobsToProcessData: ProcessedJobData[],
  startRowIndex: number,
) {
  let successfulRowsCount = 0
  const results: Array<{
    jobIndex: number
    success: boolean
    error?: string
    sheetRowNumber?: number
  }> = []

  for (let i = 0; i < remainingJobsToProcessData.length; i++) {
    const jobToProcessData = remainingJobsToProcessData[i]

    try {
      const rowValues = buildRowUpdateArgs(
        jobToProcessData.$,
        tableHeaderInfo.columnNames,
        (jobToProcessData.$.step.parameters.columnValues as ColumnValue[]).map(
          (col) => ({
            columnName: col.columnName,
            value: sanitiseInputValue(col.value),
          }),
        ),
      )

      // Create individual row
      await session.request<{ index: number }>(
        `/tables/${tableId}/rows`,
        'post',
        {
          data: {
            index: null,
            values: [rowValues],
          },
        },
      )

      const sheetRowNumber = startRowIndex + successfulRowsCount + 1
      successfulRowsCount++

      results.push({
        jobIndex: i,
        success: true,
        sheetRowNumber,
      })
    } catch (error) {
      const errorMessage =
        error?.response?.data?.error?.message ||
        error.message ||
        'Unknown error'
      console.error(`Row ${i + 1} failed to create:`, error)

      results.push({
        jobIndex: i,
        success: false,
        error: errorMessage,
      })
    }
  }

  return results
}

async function batchRunHybrid(jobsToProcessData: ProcessedJobData[]) {
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

  // acquire just one session for API calls
  const { fileId, tableId } = remainingJobsToProcessData[0].$.step.parameters

  const session = await WorkbookSession.acquire(
    remainingJobsToProcessData[0].$,
    fileId as string,
  )

  try {
    const tableHeaderInfoResponse = await session.request<{
      rowIndex: number
      values: string[][] // Guaranteed to be length 1 at top level
    }>(`/tables/${tableId}/headerRowRange?$select=rowIndex,values`, 'get')

    const tableHeaderInfo: TableHeaderInfo = {
      rowIndex: tableHeaderInfoResponse.data.rowIndex,
      columnNames: tableHeaderInfoResponse.data.values[0],
    }

    const currentRowIndex = tableHeaderInfoResponse.data.rowIndex + 1

    // Strategy 1: Try batch creation first (faster)
    try {
      console.log('Attempting batch creation...')

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
                  jobToProcessData.$.step.parameters
                    .columnValues as ColumnValue[]
                ).map((col) => ({
                  columnName: col.columnName,
                  value: sanitiseInputValue(col.value),
                })),
              ),
            ),
          },
        },
      )

      // Batch success - update all jobs
      const createRowsResponseData = createRowsResponse.data as any
      const firstRowIndex =
        tableHeaderInfoResponse.data.rowIndex + 1 + createRowsResponseData.index

      for (let i = 0; i < remainingJobsToProcessData.length; i++) {
        const jobToProcessData = remainingJobsToProcessData[i]
        const { $, job } = jobToProcessData
        const sheetRowNumber = firstRowIndex + i + 1

        $.setActionItem({
          raw: {
            sheetRowNumber: sheetRowNumber,
            success: true,
            method: 'batch',
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

      console.log('Batch creation successful')
    } catch (batchError) {
      // Strategy 2: Batch failed, fall back to individual creation for detailed error reporting
      console.log(
        'Batch creation failed, falling back to individual creation:',
        batchError,
      )

      const results = await createRowsIndividually(
        session,
        tableId as string,
        tableHeaderInfo,
        remainingJobsToProcessData,
        currentRowIndex,
      )

      // Process results and update job progress
      for (const result of results) {
        const jobToProcessData = remainingJobsToProcessData[result.jobIndex]
        const { $, job } = jobToProcessData

        if (result.success) {
          $.setActionItem({
            raw: {
              sheetRowNumber: result.sheetRowNumber,
              success: true,
              method: 'individual',
              rowIndex: result.jobIndex + 1,
            },
          })
        } else {
          const detailedError = new StepError(
            `Error creating table row ${result.jobIndex + 1}: ${result.error}`,
            `Row ${
              result.jobIndex + 1
            } failed validation or contains invalid data. Please check the column values and try again.`,
            $.step.position,
            $.app.name,
          )

          $.actionOutput.error = generateErrorForActionOutput(detailedError)
          $.setExecutionError(detailedError)

          $.setActionItem({
            raw: {
              success: false,
              rowIndex: result.jobIndex + 1,
              error: result.error,
              method: 'individual',
              failedData: jobToProcessData.$.step.parameters.columnValues,
            },
          })
        }

        const newJobProgressData = {
          ...(job.progress as JobProgress).jobProgressData,
          $: $,
        }
        job.updateProgress({
          jobProgressData: newJobProgressData,
        })
      }
    }
  } catch (error) {
    // If the batch function fails at the session/table level
    console.log('error with creation of rows...', error)
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

export default batchRunHybrid
