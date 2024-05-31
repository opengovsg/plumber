import type { IDataOutMetadata } from '@plumber/types'

async function getDataOutMetadata(): Promise<IDataOutMetadata> {
  return {
    message: {
      createdAt: {
        label: 'Message Creation Time',
      },
      id: {
        label: 'Message ID',
      },
    },
  } satisfies IDataOutMetadata
}

export default getDataOutMetadata

// Example dataOut:
// {
//   createdAt: '2024-01-29T17:39:35.574+08:00',
//   id: 'message_abcd-efgh'
// }
