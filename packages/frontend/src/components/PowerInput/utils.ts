import type { StepWithVariables } from 'helpers/variables'
import { Variable } from 'helpers/variables'
import { Descendant, Text, Transforms } from 'slate'
import { withHistory } from 'slate-history'
import { withReact } from 'slate-react'

import type {
  CustomSlateEditor,
  CustomSlateElement,
  VariableSlateElement,
} from './types'

// Map of variable name with curlies (e.g. '{{step.abc-def.field.1.xyz}}') to
// its label (its actual label, if defined, otherwise something like
// 'step2.field.1.xyz').
export type VariableLabelMap = Map<string, string>

export function genVariableLabelMap(
  stepsWithVariables: StepWithVariables[],
): VariableLabelMap {
  const result: VariableLabelMap = new Map()

  for (const [stepPosition, step] of stepsWithVariables.entries()) {
    for (const variable of step.output) {
      result.set(
        `{{${variable.name}}}`,
        variable.label ??
          variable.name.replace(`step.${step.id}.`, `step${stepPosition + 1}.`),
      )
    }
  }

  return result
}

const variableRegExp = /({{.*?}})/
export function deserialize(value: string): Descendant[] {
  if (!value) {
    return [
      {
        type: 'paragraph',
        children: [{ text: '' }],
      },
    ]
  }

  const stringValue = typeof value === 'string' ? value : JSON.stringify(value)

  return stringValue.split('\n').map((line) => {
    const nodes = line.split(variableRegExp)

    if (nodes.length > 1) {
      return {
        type: 'paragraph',
        children: nodes.map((node) => {
          if (node.match(variableRegExp)) {
            return {
              type: 'variable',
              value: node,
              children: [{ text: '' }],
            }
          }

          return {
            text: node,
          }
        }),
      }
    }

    return {
      type: 'paragraph',
      children: [{ text: line }],
    }
  })
}

export const serialize = (value: Descendant[]): string => {
  return value.map((node) => serializeNode(node)).join('\n')
}

const serializeNode = (node: CustomSlateElement | Descendant): string => {
  if (Text.isText(node)) {
    return node.text
  }

  if (node.type === 'variable') {
    return node.value as string
  }

  return node.children.map((n) => serializeNode(n)).join('')
}

export const withVariables = (editor: CustomSlateEditor) => {
  const { isInline, isVoid } = editor

  editor.isInline = (element: CustomSlateElement) => {
    return element.type === 'variable' ? true : isInline(element)
  }

  editor.isVoid = (element: CustomSlateElement) => {
    return element.type === 'variable' ? true : isVoid(element)
  }

  return editor
}

export function insertVariable(
  editor: CustomSlateEditor,
  variableData: Variable,
  variableLabels: VariableLabelMap,
) {
  const value = `{{${variableData.name}}}`

  const variable: VariableSlateElement = {
    type: 'variable',
    name: variableLabels.get(value),
    value,
    children: [{ text: '' }],
  }

  Transforms.insertNodes(editor, variable)
  Transforms.move(editor)
}

export const customizeEditor = (
  editor: CustomSlateEditor,
): CustomSlateEditor => {
  return withVariables(withReact(withHistory(editor)))
}
