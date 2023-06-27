import type { BaseEditor, Descendant, Text } from 'slate'
import type { ReactEditor } from 'slate-react'

export type VariableElement = {
  type: 'variable'
  value?: unknown
  name?: string
  displayedName?: string
  children: Text[]
}

export type ParagraphElement = {
  type: 'paragraph'
  children: Descendant[]
}

export type CustomEditor = BaseEditor & ReactEditor

export type CustomElement = VariableElement | ParagraphElement

declare module 'slate' {
  interface CustomTypes {
    Editor: CustomEditor
    Element: CustomElement
  }
}
