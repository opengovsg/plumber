import generateTimestamp from '@/apps/delay/helpers/generate-timestamp'

const delayUntilAsMilliseconds = (
  delayUntil: string,
  delayUntilTime: string,
) => {
  const delayTimestamp = generateTimestamp(delayUntil, delayUntilTime)
  const now = new Date()

  return delayTimestamp - now.getTime()
}

export default delayUntilAsMilliseconds
