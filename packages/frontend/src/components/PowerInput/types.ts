import type { BaseEditor, BaseElement } from 'slate'
import type { ReactEditor } from 'slate-react'

export interface VariableSlateElement extends BaseElement {
  type: 'variable'
  value?: string

  /**
   * CAVEAT: not _just_ a name; it contains the lodash.get path for dataOut. Do
   * not clobber unles you know what you're doing!
   */
  name?: string

  label?: string
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
