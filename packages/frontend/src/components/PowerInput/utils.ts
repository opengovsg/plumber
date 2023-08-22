import { type StepWithVariables, type Variable } from 'helpers/variables'
import { Descendant, Text, Transforms } from 'slate'
import { withHistory } from 'slate-history'
import { withReact } from 'slate-react'

import type { CustomEditor, CustomElement, VariableElement } from './types'

/**
 * Map of variable placeholder strings (e.g. `{{step.abc-def.0.answer}}`) to
 * their associated info:
 *
 * 1. Label obtained from dataOutMetadata (if defined). Otherwise,
 *    'step2.field.1.xyz'.
 * 2. Value obtained from the test run.
 */
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

const serializeNode = (node: CustomElement | Descendant): string => {
  if (Text.isText(node)) {
    return node.text
  }

  if (node.type === 'variable') {
    return node.value as string
  }

  return node.children.map((n) => serializeNode(n)).join('')
}

export const withVariables = (editor: CustomEditor) => {
  const { isInline, isVoid } = editor

  editor.isInline = (element: CustomElement) => {
    return element.type === 'variable' ? true : isInline(element)
  }

  editor.isVoid = (element: CustomElement) => {
    return element.type === 'variable' ? true : isVoid(element)
  }

  return editor
}

export function insertVariable(editor: CustomEditor, variableData: Variable) {
  const variable: VariableElement = {
    type: 'variable',
    value: `{{${variableData.name}}}`,
    children: [{ text: '' }],
  }

  Transforms.insertNodes(editor, variable)
  Transforms.move(editor)
}

export const customizeEditor = (editor: CustomEditor): CustomEditor => {
  return withVariables(withReact(withHistory(editor)))
}
