const delayUntilAsMilliseconds = (
  delayUntil: string,
  delayUntilTime: string,
) => {
  const dateString = `${delayUntil} ${delayUntilTime} GMT+8`
  const delayUntilDate = new Date(dateString)
  const now = new Date()
  const timestamp = Date.parse(dateString)
  if (isNaN(timestamp)) {
    throw new Error('Worker: Invalid timestamp!')
  }

  return delayUntilDate.getTime() - now.getTime()
}

export default delayUntilAsMilliseconds
