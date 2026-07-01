export interface DynamicPickerData {
  question: string
  stepId: string
  key: string
}

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

  for (const line of lines) {
    if (line.startsWith('Q:')) {
      question = line.slice(2).trim()
    } else if (line.startsWith('STEP_ID:')) {
      stepId = line.slice(8).trim()
    } else if (line.startsWith('KEY:')) {
      key = line.slice(4).trim()
    }
  }

  if (!question || !stepId || !key) {
    return null
  }

  return { question, stepId, key }
}
