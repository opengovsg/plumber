import { StepWithVariables } from 'helpers/variables'

export type VariableInfoMap = Map<
  string,
  {
    label: string
    testRunValue: string
  }
>

export function genVariableInfoMap(
  stepsWithVariables: StepWithVariables[],
): VariableInfoMap {
  const result: VariableInfoMap = new Map()

  for (const [stepPosition, step] of stepsWithVariables.entries()) {
    for (const variable of step.output) {
      const placeholderString = `{{${variable.name}}}`
      const label =
        variable.label ??
        variable.name.replace(`step.${step.id}.`, `step${stepPosition + 1}.`)
      const testRunValue = variable.displayedValue ?? String(variable.value)

      result.set(placeholderString, {
        label,
        testRunValue,
      })
    }
  }

  return result
}

export function substituteOldTemplates(
  original: string,
  varInfo: VariableInfoMap,
): string {
  const searchRegex = /({{[^{}]+}})(?!<\/span>)/
  const nodes = original.split(searchRegex)
  for (const i in nodes) {
    if (!searchRegex.test(nodes[i])) {
      continue
    }
    const id = nodes[i].replace('{{', '').replace('}}', '')
    const idComponents = id.split('.')
    const label = idComponents[idComponents.length - 1]
    const value = varInfo.get(nodes[i])?.testRunValue || ''
    nodes[
      i
    ] = `<span data-type="variable" data-id="${id}" data-label="${label}" data-value="${value}">${nodes[i]}</span>`
  }
  return nodes.join('')
}
