export const parseError = (error: Error | any) => {
  const responseStatus = error?.response?.status || 'default'
  let stepErrorName = 'Failed to process document'
  let stepErrorSolution = 'Please try again.'

  switch (responseStatus) {
    case 400:
      stepErrorName = 'Invalid request'
      stepErrorSolution = 'Please try again.'
      break
    case 413:
      stepErrorName = 'File too large'
      stepErrorSolution = 'Please try again with a smaller file.'

      break
    case 429:
      stepErrorName = 'Too many requests'
      stepErrorSolution = 'Please try again later.'
      break
    case 503:
      stepErrorName = 'Service unavailable'
      stepErrorSolution = 'Please try again later.'
      break
    default:
      break
  }

  return { stepErrorName, stepErrorSolution }
}
