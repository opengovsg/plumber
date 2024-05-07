import apps from '@/apps'
import Step from '@/models/step'

export function doesActionProcessFiles(step: Step): boolean {
  if (!apps[step.appKey]) {
    return false
  }
  const action = apps[step.appKey].actions.find((a) => a.key === step.key)
  if (!action || !action.doesFileProcessing) {
    return false
  }

  return action.doesFileProcessing(step)
}
