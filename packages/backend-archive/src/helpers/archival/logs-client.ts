import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs'

export const logsClient = new CloudWatchLogsClient({ region: 'ap-southeast-1' })
