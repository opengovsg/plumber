export const parseError = (error: Error | any) => {
  let stepErrorName = 'Failed to call model'
  let stepErrorSolution = 'Please try again.'

  if (
    error.response.data.message === `Request Too Long` ||
    error.message === 'File too large'
  ) {
    stepErrorName = 'Request too long'
    stepErrorSolution = 'Please try again with a smaller file.'
  }

  if (error.response.data.message.includes('Quota exceeded')) {
    stepErrorName = 'Quota exceeded'
    stepErrorSolution = 'Please contact AISAY to increase your quota.'
  }

  return { stepErrorName, stepErrorSolution }
}
