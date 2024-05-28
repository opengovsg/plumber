import './RichTextEditor.scss'

import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { ClickAwayListener, FormControl } from '@mui/material'
import { FormLabel } from '@opengovsg/design-system-react'
import Document from '@tiptap/extension-document'
import Hardbreak from '@tiptap/extension-hard-break'
import Link from '@tiptap/extension-link'
import Paragraph from '@tiptap/extension-paragraph'
import Placeholder from '@tiptap/extension-placeholder'
import Table from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import Text from '@tiptap/extension-text'
import Underline from '@tiptap/extension-underline'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { StepExecutionsContext } from 'contexts/StepExecutions'
import { extractVariables, filterVariables, Variable } from 'helpers/variables'

import { MenuBar } from './MenuBar'
import ImageResize from './ResizableImageExtension'
import { StepVariable } from './StepVariablePlugin'
import { SuggestionsPopper } from './SuggestionPopper'
import { genVariableInfoMap, substituteOldTemplates } from './utils'

const RICH_TEXT_EXTENSIONS = [
  Document.configure({
    HTMLAttributes: { style: 'min-height: 9rem' },
  }),
  StarterKit.configure({
    paragraph: {
      HTMLAttributes: { style: 'margin: 0' },
    },
  }),
  Link.configure({
    HTMLAttributes: { rel: null, target: '_blank' },
  }),
  Underline,
  Table.configure({
    resizable: false,
    HTMLAttributes: {
      style: 'border-collapse:collapse;',
    },
  }),
  TableRow,
  TableHeader,
  TableCell.configure({
    HTMLAttributes: {
      style:
        'border:1px solid black;padding: 5px 10px;min-width: 100px;height: 15px;',
    },
  }),
  ImageResize.configure({
    inline: true,
  }),
]

interface EditorProps {
  onChange: (...event: any[]) => void
  initialValue: string
  editable?: boolean
  placeholder?: string
  variablesEnabled?: boolean
  isRich?: boolean
}
const Editor = ({
  onChange,
  initialValue,
  editable,
  placeholder,
  variablesEnabled,
  isRich,
}: EditorProps) => {
  const priorStepsWithExecutions = useContext(StepExecutionsContext)
  const [showVarSuggestions, setShowVarSuggestions] = useState(false)
  const editorRef = useRef<HTMLDivElement | null>(null)

  const [stepsWithVariables, varInfo] = useMemo(() => {
    const stepsWithVars = filterVariables(
      extractVariables(priorStepsWithExecutions),
      (variable) => (variable.type ?? 'text') === 'text',
    )
    const info = genVariableInfoMap(stepsWithVars)
    return [stepsWithVars, info]
  }, [priorStepsWithExecutions])

  const extensions: Array<any> = [
    Placeholder.configure({
      placeholder,
    }),
    StepVariable,
  ]
  let content = substituteOldTemplates(initialValue, varInfo) // back-ward compatibility with old values from PowerInput

  // convert new line character into br elem so tiptap can load the content correctly
  content = content.replaceAll('\n', '<br>')
  if (isRich) {
    extensions.push(...RICH_TEXT_EXTENSIONS)
  } else {
    // this extension is to have <br /> as new line instead of new paragraph
    // as new paragraph will translate to a double \n\n instead of \n when getText
    extensions.push(
      Document,
      Text,
      Paragraph.configure({
        HTMLAttributes: { style: 'margin: 0' },
      }),
      Hardbreak.extend({
        addKeyboardShortcuts() {
          return {
            Enter: () => this.editor.commands.setHardBreak(),
          }
        },
      }),
    )
  }

  const editor = useEditor({
    extensions,
    content,
    onUpdate: ({ editor }) => {
      if (editor.isEmpty) {
        // this is when content of the editor is empty
        // set controller value to empty string instead so the required rule can
        // work properly
        onChange('')
        return
      }

      onChange(isRich ? editor.getHTML() : editor.getText())
    },
    editable,
    // To simulate textarea and coordinate with dropdown input size
    onCreate: ({ editor }) => {
      const editorElement = editor.view.dom as HTMLElement
      editorElement.style.minHeight = isRich ? '9rem' : '2.625rem' // Set initial minHeight directly
    },
  })
  useEffect(() => {
    // have to listen to editable as this element might not re-render upon
    // publish and unpublish of pipe
    editor?.setOptions({ editable })
  }, [editable, editor])

  const handleVariableClick = useCallback(
    (variable: Variable) => {
      editor?.commands.insertContent({
        type: StepVariable.name,
        attrs: {
          id: variable.name,
          label: variable.label,
          value: variable.value,
        },
      })
      editor?.commands.focus()
    },
    [editor],
  )

  return (
    <div className="editor">
      <ClickAwayListener
        mouseEvent="onMouseDown"
        onClickAway={() => setShowVarSuggestions(false)}
      >
        <div ref={editorRef}>
          {isRich && <MenuBar editor={editor} />}
          <EditorContent
            className="editor__content"
            editor={editor}
            onFocus={() => setShowVarSuggestions(true)}
          />
          {variablesEnabled && (
            <SuggestionsPopper
              open={showVarSuggestions}
              anchorEl={editorRef.current}
              data={stepsWithVariables}
              onSuggestionClick={handleVariableClick}
            />
          )}
        </div>
      </ClickAwayListener>
    </div>
  )
}

interface RichTextEditorProps {
  required?: boolean
  defaultValue?: string
  name: string
  label?: string
  description?: string
  disabled?: boolean
  placeholder?: string
  variablesEnabled?: boolean
  isRich?: boolean
}
const RichTextEditor = ({
  required,
  defaultValue,
  name,
  label,
  description,
  disabled,
  placeholder,
  variablesEnabled,
  isRich,
}: RichTextEditorProps) => {
  const { control } = useFormContext()
  return (
    <FormControl style={{ flexGrow: 1 }} data-test="text-input-group">
      {label && (
        <FormLabel isRequired={required} description={description}>
          {label}
        </FormLabel>
      )}
      <Controller
        rules={{ required }}
        name={name}
        control={control}
        defaultValue={defaultValue}
        shouldUnregister={false}
        render={({ field: { onChange, value } }) => (
          <Editor
            onChange={onChange}
            initialValue={value}
            editable={!disabled}
            placeholder={placeholder}
            variablesEnabled={variablesEnabled}
            isRich={isRich}
          />
        )}
      />
    </FormControl>
  )
}

export const BareEditor = Editor
export default RichTextEditor
