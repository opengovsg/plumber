import StepError from '@/errors/step'
import { generateErrorForActionOutput } from '@/services/batch-action'
import { type ProcessedJobData } from '@/workers/helpers/process-batch-action-job'

// This is a test batch run function to test the batching functionality
export default async function testBatchRun(
  jobsToProcessData: ProcessedJobData[],
) {
  // Capture error for every odd job
  for (let i = 0; i < jobsToProcessData.length; i++) {
    const jobToProcessData = jobsToProcessData[i]
    const { $ } = jobToProcessData
    try {
      if (i % 2 === 1) {
        throw new StepError(
          'There was a problem with the input.',
          'No solution found',
          $.step?.position,
          $.app.name,
        )
      }

      $.setActionItem({
        raw: {
          success: true,
        },
      })
    } catch (error) {
      $.actionOutput.error = generateErrorForActionOutput(error)
      $.executionError = error
    }
  }
}
