import { mergeAttributes, Node } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { VariableBadge } from './VariableBadge'

export type VariableOptions = {
  HTMLAttributes: Record<string, any>
}
const key = 'variable'
export const VariablePluginKey = new PluginKey(key)

export const StepVariable = Node.create<VariableOptions>({
  name: key,
  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },
  group: 'inline',
  inline: true,
  selectable: true,
  atom: true,
  addAttributes() {
    // attributes equivalent of
    // id: step name
    // label: step label
    // value: step test value
    // these are only used for NodeView purpose
    // we technically don't need to render them into the final HTML value, however
    // they need to be rendered there for rich text editor to be able to resume
    // where user left off. The resulting content render won't be affected by
    // these data- attributes
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-id'),
        renderHTML: (attrs) => {
          if (!attrs.id) {
            return {}
          }

          return {
            'data-id': attrs.id,
          }
        },
      },
      label: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-label'),
        renderHTML: (attrs) => {
          if (!attrs.label) {
            return {}
          }

          return {
            'data-label': attrs.label,
          }
        },
      },
      value: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-value'),
        renderHTML: (attrs) => {
          if (!attrs.value) {
            return {}
          }

          return {
            'data-value': attrs.value,
          }
        },
      },
    }
  },
  parseHTML() {
    return [
      {
        tag: `span[data-type="${this.name}"]`,
      },
    ]
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(
        { 'data-type': this.name },
        this.options.HTMLAttributes,
        // we only want to save data-type and data-id
        {
          'data-id': HTMLAttributes['data-id'],
        },
      ),
      `{{${node.attrs.id}}}`,
    ]
  },
  renderText({ node }) {
    return `{{${node.attrs.id}}}`
  },
  addNodeView() {
    return ReactNodeViewRenderer(VariableBadge, {
      attrs: {
        style: 'display: inline-block;',
      },
    })
  },
  addKeyboardShortcuts() {
    return {
      /**
       * NOTE: this is a fix for deleting text or whitespace before a variable node using Backspace key
       *
       * ROOT CAUSE:
       * ProseMirror’s default Backspace logic is conservative at inline atom boundaries.
       * Since the variable badge is an atom, Backspace right before it may prefer acting on the
       * atom boundary or do nothing instead of removing the character immediately before the variable.
       *
       * FIX: overrides ambiguous boundary handling and ensures predictable Backspace semantics
       * Checks that the caret is immediately before the variable and not at the start of the text block.
       * Explicitly deletes one character to the left (from: $head.pos - 1, to: $head.pos).
       */
      Backspace: ({ editor }) => {
        const { selection } = editor.state
        const { $head } = selection

        if (
          // ensures we’re at a boundary right before the variable atom.
          $head.nodeAfter?.type.name === this.name &&
          // ensures we’re not at the start of the current text block,
          // where deleting left might merge blocks or have other structural effects.
          $head.pos > 0 &&
          // extra safety so we don’t try to delete past the document start
          $head.parentOffset > 0
        ) {
          editor.commands.deleteRange({ from: $head.pos - 1, to: $head.pos })
          return true
        }

        return false
      },
      /**
       * NOTE: this is a fix for deleting text or whitespace before a variable node using Delete key
       *
       * ROOT CAUSE:
       * ProseMirror’s default forward-delete is conservative at inline atom boundaries.
       * The variable badge is an atom (atom: true, selectable: true).
       * When the caret sits just before an inline atom, the built-in behavior prioritises the atom boundary
       * over adjacent text and can either try to delete the atom or do nothing.
       * As a result, the single character or whitespace immediately before the variable often won’t delete as expected.
       *
       * FIX:
       * Override the ambiguous default behaviour around atom boundaries
       * If the next node is text, it deletes exactly one character (including whitespace).
       * Otherwise, if the next node is the variable atom, it deletes the atom.
       */
      Delete: ({ editor }) => {
        const { selection } = editor.state
        const { $head } = selection

        const nextNode = $head.nodeAfter

        // If the next node is a text node (including whitespace), delete the next character
        // ensures the immediate content after the caret is a text node with at least one character (including whitespace)
        if (nextNode?.isText && nextNode.text && nextNode.text.length > 0) {
          editor.commands.deleteRange({ from: $head.pos, to: $head.pos + 1 })
          return true
        }

        // If cursor is right before a variable node, delete the whole variable atom
        // confirms the immediate next inline node is the variable atom.
        if (nextNode?.type.name === this.name) {
          // delete the entire atom using its nodeSize, preserving the atomic behavior of the variable badge
          // and avoiding partial/invalid deletions.
          const nodeSize = nextNode.nodeSize
          editor.commands.deleteRange({
            from: $head.pos,
            to: $head.pos + nodeSize,
          })
          return true
        }

        return false
      },
    }
  },
})
