import Step from '@/models/step'

export const getPrompts = async (stepId: string) => {
  const step = await Step.query().findById(stepId)
  if (!Array.isArray(step.parameters.prompts)) {
    return []
  }
  return step.parameters.prompts.map((i: { prompt: string }) => i.prompt)
}
