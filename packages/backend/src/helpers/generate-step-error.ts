import HttpError from '@/errors/http'
import StepError from '@/errors/step'

const appKeyToActionMapping: Record<string, string> = {
  'custom-api': 'Custom API',
  delay: 'Delay',
  postman: 'Email by Postman',
}

export function generateHttpStepError(
  error: HttpError,
  solution: string,
  position: number,
  appKey: string,
) {
  const stepErrorName = `Status code: ${error.response.status} (${error.response.statusText})`
  return new StepError(
    {
      name: stepErrorName,
      solution,
      position: position.toString(),
      action: appKeyToActionMapping[appKey] ?? appKey,
    },
    { cause: error },
  )
}

export function generateStepError(
  name: string,
  solution: string,
  position: number,
  appKey: string,
) {
  return new StepError({
    name,
    solution,
    position: position.toString(),
    action: appKeyToActionMapping[appKey] ?? appKey,
  })
}
