import Step from '@/models/step'

export const getInfoToExtract = async (stepId: string) => {
  const step = await Step.query().findById(stepId)
  if (!Array.isArray(step.parameters.infoToExtract)) {
    return []
  }
  return step.parameters.infoToExtract.map(
    (i: { infoToExtract: string }) => i.infoToExtract,
  )
}
