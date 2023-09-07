const delayUntilAsMilliseconds = (
  delayUntil: string,
  delayUntilTime: string,
) => {
  const dateString = `${delayUntil} ${delayUntilTime} GMT+8`
  const delayUntilDate = new Date(dateString)
  const now = new Date()
  const timestamp = Date.parse(dateString)
  if (isNaN(timestamp)) {
    throw new Error(
      '[Action worker] Delay set for next action: Invalid timestamp!',
    )
  }

  return delayUntilDate.getTime() - now.getTime()
}

export default delayUntilAsMilliseconds
