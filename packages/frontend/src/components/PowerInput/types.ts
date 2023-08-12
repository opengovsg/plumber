import type { BaseEditor, BaseElement } from 'slate'
import type { ReactEditor } from 'slate-react'

export interface VariableSlateElement extends BaseElement {
  type: 'variable'
  placeholderString: string
}

export interface ParagraphSlateElement extends BaseElement {
  type: 'paragraph'
}

export type CustomSlateEditor = BaseEditor & ReactEditor

export type CustomSlateElement = VariableSlateElement | ParagraphSlateElement

declare module 'slate' {
  interface CustomTypes {
    Editor: CustomSlateEditor
    Element: CustomSlateElement
  }
}
