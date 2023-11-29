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
import Hardbreak from '@tiptap/extension-hard-break'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Table from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
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

interface EditorProps {
  onChange: (...event: any[]) => void
  initialValue: string
  editable?: boolean
  placeholder?: string
  variablesEnabled?: boolean
}
const Editor = ({
  onChange,
  initialValue,
  editable,
  placeholder,
  variablesEnabled,
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
    StarterKit,
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
        style: 'border:1px solid black;',
      },
    }),
    Placeholder.configure({
      placeholder,
    }),
    ImageResize.configure({
      inline: true,
    }),
    StepVariable,
  ]
  let content = substituteOldTemplates(initialValue, varInfo) // back-ward compatibility with old values from PowerInput

  // convert new line character into br elem so tiptap can load the content correctly
  content = content.replaceAll('\n', '<br>')
  // this extension is to have <br /> as new line instead of new paragraph
  // as new paragraph will translate to a double \n\n instead of \n when getText
  extensions.push(
    Hardbreak.extend({
      addKeyboardShortcuts() {
        return {
          Enter: () => this.editor.commands.setHardBreak(),
        }
      },
    }),
  )

  const editor = useEditor({
    extensions,
    content,
    onUpdate: ({ editor }) => {
      const content = editor.getHTML()
      if (content === '<p></p>') {
        // this is when content of the editor is empty
        // set controller value to empty string instead so the required rule can
        // work properly
        onChange('')
        return
      }

      onChange(content)
    },
    editable,
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
          <MenuBar editor={editor} />
          <EditorContent
            className="editor__content"
            editor={editor}
            placeholder="Hello world"
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
}: RichTextEditorProps) => {
  const { control } = useFormContext()
  return (
    <FormControl>
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
          />
        )}
      />
    </FormControl>
  )
}

export default RichTextEditor
