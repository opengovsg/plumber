import { StepWithVariables } from 'helpers/variables'
import { HTMLElement, parse, TextNode } from 'node-html-parser'

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

function substituteTemplateStringWithSpan(
  s: string,
  varInfo: VariableInfoMap,
): HTMLElement {
  const searchRegex = /({{[^{}]+}})/
  const nodes = s.split(searchRegex)
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
  return parse(nodes.join(''))
}
function recursiveSubstitute(
  el: HTMLElement,
  varInfo: VariableInfoMap,
): HTMLElement {
  if (
    el.getAttribute('data-type') === 'variable' &&
    el.getAttribute('data-id')
  ) {
    // is already a variable span
    return el
  }
  el.childNodes = el.childNodes.map((n) => {
    if (n instanceof HTMLElement) {
      return recursiveSubstitute(n, varInfo)
    } else if (n instanceof TextNode) {
      return substituteTemplateStringWithSpan(n.textContent, varInfo)
    }
    return n
  })
  return el
}
export function substituteOldTemplates(
  original: string,
  varInfo: VariableInfoMap,
): string {
  if (!original) {
    return ''
  }
  const originalElem = parse(original)
  return recursiveSubstitute(originalElem, varInfo).outerHTML
}
