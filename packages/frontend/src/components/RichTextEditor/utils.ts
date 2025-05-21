import { FieldValues, UseFormGetValues } from 'react-hook-form'
import { PlacementWithLogical } from '@chakra-ui/react'
import { Editor } from '@tiptap/react'
import {
  HTMLElement as NodeHTMLElement,
  Node,
  parse,
  TextNode,
} from 'node-html-parser'

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
export const GLOBAL_VARIABLE_REGEX = new RegExp(VARIABLE_REGEX, 'g')
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
): NodeHTMLElement {
  const idComponents = id.split('.')
  const varInfoForNode = varInfo.get(`{{${id}}}`)
  const value = varInfoForNode?.testRunValue || ''
  const label = varInfoForNode?.label || idComponents[idComponents.length - 1]
  const span = new NodeHTMLElement('span', {})
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
  el: NodeHTMLElement,
  varInfo: VariableInfoMap,
): NodeHTMLElement {
  const dataIdAttr = el.getAttribute('data-id')
  const dataTypeAttr = el.getAttribute('data-type')
  if (dataTypeAttr === 'variable' && dataIdAttr != null) {
    // if node is already a variable span,
    // we should reconstruct a new span element with the latest data
    return constructVariableSpanElement(varInfo, dataIdAttr)
  }
  const newChildNodes: Node[] = []
  el.childNodes.forEach((n) => {
    if (n instanceof NodeHTMLElement) {
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

export function getPopoverPlacement(
  editor: Editor | null,
): PlacementWithLogical {
  if (typeof window === 'undefined' || editor == null) {
    return 'bottom-start'
  }

  const editorElement = editor?.view.dom as HTMLElement
  if (!editorElement) {
    return 'bottom-start'
  }

  const rect = editorElement.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom
  const spaceAbove = rect.top

  // If there's more space above than below, show the popover above
  return spaceAbove > spaceBelow ? 'top-start' : 'bottom-start'
}

export const checkAutoFocus = (
  name: string,
  getValues: UseFormGetValues<FieldValues>,
  autoFocusProp?: boolean,
) => {
  const pathParts = name.split('.')
  const fieldParentPath = pathParts.slice(0, -1).join('.')
  const rowData = getValues(fieldParentPath)
  const isNewRow = rowData?.isNew
  return { shouldAutoFocus: isNewRow && autoFocusProp, isNewRow, rowData }
}

// Add scrolling behavior for single-line mode
export const singleLineEditorScroll = (editor: Editor) => {
  if (!editor) {
    return
  }

  setTimeout(() => {
    const singleLineEditor = editor.view.dom.closest(
      '.single-line-editor',
    ) as HTMLElement
    if (singleLineEditor) {
      // Get the current cursor position
      const pos = editor.state.selection.$head.pos
      let targetVariable = findClosestVariableNode(
        editor,
        pos,
        singleLineEditor,
      )

      // If we still haven't found it, fall back to the last variable
      if (!targetVariable) {
        const variables = Array.from(
          singleLineEditor.getElementsByClassName('node-variable'),
        ) as HTMLElement[]
        if (variables.length > 0) {
          targetVariable = variables[variables.length - 1]
        }
      }

      // Scroll to the target variable if found
      if (targetVariable) {
        scrollVariableIntoView(targetVariable, singleLineEditor)
      }
    }
  }, 10)
}

export function findClosestVariableNode(
  editor: any,
  pos: number,
  container: HTMLElement,
): HTMLElement | null {
  for (let offset = -1; offset <= 1; offset++) {
    const checkPos = Math.max(0, pos + offset)
    const domInfo = editor.view.domAtPos(checkPos)
    const node = domInfo.node as HTMLElement

    if (node.classList?.contains('node-variable')) {
      return node
    }

    const prevSibling = node.previousElementSibling as HTMLElement
    if (prevSibling?.classList?.contains('node-variable')) {
      return prevSibling
    }

    const nextSibling = node.nextElementSibling as HTMLElement
    if (nextSibling?.classList?.contains('node-variable')) {
      return nextSibling
    }
  }

  // Fallback: last variable in the container
  const variables = container.getElementsByClassName('node-variable')
  return variables.length > 0
    ? (variables[variables.length - 1] as HTMLElement)
    : null
}

export function scrollVariableIntoView(
  target: HTMLElement,
  container: HTMLElement,
) {
  const targetDiv = target
  const containerWidth = container.clientWidth
  const scrollLeft =
    targetDiv.offsetLeft - containerWidth + targetDiv.offsetWidth + 20
  container.scrollTo({
    left: Math.max(0, scrollLeft),
    behavior: 'smooth',
  })
}
