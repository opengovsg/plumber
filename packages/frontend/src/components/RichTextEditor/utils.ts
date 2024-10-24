import { HTMLElement, Node, parse, TextNode } from 'node-html-parser'

import type { StepWithVariables } from '@/helpers/variables'

export type VariableInfoMap = Map<
  string,
  {
    label: string
    testRunValue: string
  }
>

const VARIABLE_REGEX =
  /({{step\.[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}(?:\.[\da-zA-Z-_ ]+)+}})/
const GLOBAL_VARIABLE_REGEX = new RegExp(VARIABLE_REGEX, 'g')
/**
 * Used to generate substituted string for hyperlink checking
 */
export function simpleSubstitute(
  original: string,
  varInfo: VariableInfoMap,
): string {
  return original.replaceAll(GLOBAL_VARIABLE_REGEX, (match) => {
    const id = match.replace('{{', '').replace('}}', '')
    const varInfoForNode = varInfo.get(`{{${id}}}`)
    return varInfoForNode?.testRunValue || ''
  })
}

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

/**
 * Note: template variable will not require varInfo since value should be empty.
 * Template variable should take the same format as a step variable
 * but using a fake step id defined in VariableBadge.tsx file
 */
function constructVariableSpanElement(
  varInfo: VariableInfoMap,
  id: string,
): HTMLElement {
  const idComponents = id.split('.')
  const varInfoForNode = varInfo.get(`{{${id}}}`)
  const value = varInfoForNode?.testRunValue || ''
  const label = varInfoForNode?.label || idComponents[idComponents.length - 1]
  const span = new HTMLElement('span', {})
  span.setAttribute('data-type', 'variable')
  span.setAttribute('data-id', id)
  span.setAttribute('data-label', label)
  span.setAttribute('data-value', value)
  span.set_content(`{{${id}}}`)
  return span
}

function substituteTemplateStringWithSpan(
  s: string,
  varInfo: VariableInfoMap,
): Node[] {
  const substrings = s.split(VARIABLE_REGEX)
  const nodes: Node[] = []
  for (const substring of substrings) {
    if (!VARIABLE_REGEX.test(substring)) {
      nodes.push(new TextNode(substring))
      continue
    }
    const id = substring.replace('{{', '').replace('}}', '')
    const spanElement = constructVariableSpanElement(varInfo, id)
    nodes.push(spanElement)
  }

  return nodes
}

function recursiveSubstitute(
  el: HTMLElement,
  varInfo: VariableInfoMap,
): HTMLElement {
  const dataIdAttr = el.getAttribute('data-id')
  const dataTypeAttr = el.getAttribute('data-type')
  if (dataTypeAttr === 'variable' && dataIdAttr != null) {
    // if node is already a variable span,
    // we should reconstruct a new span element with the latest data
    return constructVariableSpanElement(varInfo, dataIdAttr)
  }
  const newChildNodes: Node[] = []
  el.childNodes.forEach((n) => {
    if (n instanceof HTMLElement) {
      newChildNodes.push(recursiveSubstitute(n, varInfo))
    } else if (n instanceof TextNode) {
      // We cannot use n.textContent here because it will unescape all HTML tags
      newChildNodes.push(
        ...substituteTemplateStringWithSpan(n.rawText, varInfo),
      )
    } else {
      newChildNodes.push(n)
    }
  })
  el.childNodes = newChildNodes
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
  const substitutedDom = recursiveSubstitute(originalElem, varInfo)
  return substitutedDom.outerHTML
}
