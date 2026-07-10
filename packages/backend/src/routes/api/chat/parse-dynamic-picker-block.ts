export type DynamicPickerData =
  | { question: string; stepId: string; key: string }
  | { question: string; appKey: string }

export function parseDynamicPickerBlock(
  text: string,
): DynamicPickerData | null {
  const match = text.match(/<!--\s*DYNAMIC_PICKER_DATA\s*([\s\S]*?)\s*-->/)
  if (!match) {
    return null
  }

  const lines = match[1]
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  let question = ''
  let stepId = ''
  let key = ''
  let appKey = ''

  for (const line of lines) {
    if (line.startsWith('Q:')) {
      question = line.slice(2).trim()
    } else if (line.startsWith('STEP_ID:')) {
      stepId = line.slice(8).trim()
    } else if (line.startsWith('KEY:')) {
      key = line.slice(4).trim()
    } else if (line.startsWith('APP_KEY:')) {
      appKey = line.slice(8).trim()
    }
  }

  if (!question) {
    return null
  }

  const hasStepMode = Boolean(stepId && key)
  const hasAppMode = Boolean(appKey)

  if (hasStepMode === hasAppMode) {
    // both present or neither present — invalid
    return null
  }

  if (hasAppMode) {
    return { question, appKey }
  }

  return { question, stepId, key }
}
