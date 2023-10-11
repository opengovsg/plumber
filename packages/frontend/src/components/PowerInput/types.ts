import type { BaseEditor, BaseElement } from 'slate'
import type { ReactEditor } from 'slate-react'

export interface VariableElement extends BaseElement {
  type: 'variable'
  value: string
}

export interface ParagraphElement extends BaseElement {
  type: 'paragraph'
}

export type CustomEditor = BaseEditor & ReactEditor

export type CustomElement = VariableElement | ParagraphElement

declare module 'slate' {
  interface CustomTypes {
    Editor: CustomEditor
    Element: CustomElement
  }
}
