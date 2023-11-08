import { IDataOutMetadata, IExecutionStep } from '@plumber/types'

async function getDataOutMetadata(
  executionStep: IExecutionStep,
): Promise<IDataOutMetadata> {
  const { dataOut: data } = executionStep
  if (!data) {
    return null
  }

  const metadata: IDataOutMetadata = {}
  for (const key of Object.keys(data)) {
    // re-label "pretty" variables for scheduler
    switch (key) {
      case 'pretty_date':
        metadata[key] = {
          label: 'Date',
        }
        break
      case 'pretty_time':
        metadata[key] = {
          label: 'Time',
        }
        break
      case 'ISO_date_time':
        metadata[key] = {
          label: 'Standard date and time',
        }
        break
      case 'pretty_day_of_week':
        metadata[key] = {
          label: 'Day of the week',
        }
        break
      default:
        metadata[key] = {
          label: key,
        }
    }
  }
  return metadata
}

export default getDataOutMetadata
