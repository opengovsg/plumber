import * as React from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { FormControl } from '@chakra-ui/react'
import ClickAwayListener from '@mui/base/ClickAwayListener'
import Chip from '@mui/material/Chip'
import Popper from '@mui/material/Popper'
import { FormLabel } from '@opengovsg/design-system-react'
import { StepExecutionsContext } from 'contexts/StepExecutions'
import { createEditor } from 'slate'
import {
  Editable,
  RenderElementProps,
  Slate,
  useFocused,
  useSelected,
} from 'slate-react'

import {
  extractVariables,
  filterVariables,
  StepWithVariables,
  Variable,
} from '../../helpers/variables'

import { FakeInput } from './style'
import Suggestions from './Suggestions'
import { CustomSlateElement, VariableSlateElement } from './types'
import {
  customizeEditor,
  deserialize,
  genVariableLabelMap,
  insertVariable,
  serialize,
  VariableLabelMap,
} from './utils'

// FIXME (ogp-weeloong): Refactor this to something cleaner later...
const VariableLabelMapContext = React.createContext<VariableLabelMap>(
  new Map<string, string>(),
)

type PowerInputProps = {
  onChange?: (value: string) => void
  onBlur?: (value: string) => void
  defaultValue?: string
  name: string
  label?: string
  type?: string
  required?: boolean
  readOnly?: boolean
  description?: string
  docUrl?: string
  clickToCopy?: boolean
  disabled?: boolean
  placeholder?: string
}

const PowerInput = (props: PowerInputProps) => {
  const { control } = useFormContext()
  const {
    defaultValue = '',
    onBlur,
    name,
    label,
    required,
    description,
    disabled,
    placeholder,
  } = props
  const priorStepsWithExecutions = React.useContext(StepExecutionsContext)
  const editorRef = React.useRef<HTMLDivElement | null>(null)
  const renderElement = React.useCallback<
    (props: RenderElementProps) => JSX.Element
  >((props) => <Element {...props} />, [])
  const editor = React.useMemo(() => customizeEditor(createEditor()), [])
  const [showVariableSuggestions, setShowVariableSuggestions] =
    React.useState(false)

  const [stepsWithVariables, variableLabelMap] = React.useMemo(() => {
    const stepsWithVars = filterVariables(
      extractVariables(priorStepsWithExecutions),
      (variable) => (variable.type ?? 'text') === 'text',
    )
    const labels = genVariableLabelMap(stepsWithVars)
    return [stepsWithVars, labels]
  }, [priorStepsWithExecutions])

  const handleBlur = React.useCallback(
    (value: string) => {
      onBlur?.(value)
    },
    [onBlur],
  )

  const handleVariableSuggestionClick = React.useCallback(
    (variable: Variable) => {
      insertVariable(editor, variable)
    },
    [editor],
  )

  return (
    <Controller
      rules={{ required }}
      name={name}
      control={control}
      defaultValue={defaultValue}
      shouldUnregister={false}
      render={({
        field: {
          value: fieldValue,
          onChange: controllerOnChange,
          onBlur: controllerOnBlur,
        },
      }) => (
        <FormControl>
          <Slate
            editor={editor}
            value={deserialize(fieldValue)}
            onChange={(value) => {
              controllerOnChange(serialize(value))
            }}
          >
            {label && (
              <FormLabel isRequired={required} description={description}>
                {label}
              </FormLabel>
            )}
            <ClickAwayListener
              mouseEvent="onMouseDown"
              onClickAway={() => {
                setShowVariableSuggestions(false)
              }}
            >
              {/* ref-able single child for ClickAwayListener */}
              <div style={{ width: '100%' }} data-test="power-input">
                <FakeInput disabled={disabled}>
                  <VariableLabelMapContext.Provider value={variableLabelMap}>
                    <Editable
                      placeholder={placeholder}
                      readOnly={disabled}
                      style={{ width: '100%' }}
                      renderElement={renderElement}
                      onFocus={() => {
                        setShowVariableSuggestions(true)
                      }}
                      onBlur={() => {
                        controllerOnBlur()
                        handleBlur(fieldValue)
                      }}
                    />
                  </VariableLabelMapContext.Provider>
                </FakeInput>

                {/* ghost placer for the variables popover */}
                <div ref={editorRef} style={{ width: '100%' }} />

                <SuggestionsPopper
                  open={showVariableSuggestions}
                  anchorEl={editorRef.current}
                  data={stepsWithVariables}
                  onSuggestionClick={handleVariableSuggestionClick}
                />
              </div>
            </ClickAwayListener>
          </Slate>
        </FormControl>
      )}
    />
  )
}

interface SuggestionsPopperProps {
  open: boolean
  anchorEl: HTMLDivElement | null
  data: StepWithVariables[]
  onSuggestionClick: (variable: Variable) => void
}

const SuggestionsPopper = (props: SuggestionsPopperProps) => {
  const { open, anchorEl, data, onSuggestionClick } = props

  return (
    <Popper
      open={open}
      anchorEl={anchorEl}
      style={{ width: anchorEl?.clientWidth, zIndex: 1 }}
      modifiers={[
        {
          name: 'flip',
          enabled: false,
          options: {
            altBoundary: false,
          },
        },
      ]}
    >
      <Suggestions data={data} onSuggestionClick={onSuggestionClick} />
    </Popper>
  )
}

interface ElementProps extends RenderElementProps {
  children: React.ReactNode
  element: CustomSlateElement
}

const Element = (props: ElementProps) => {
  const { attributes, children, element } = props

  switch (element.type) {
    case 'variable':
      return (
        <VariablePill attributes={attributes} element={element}>
          {children}
        </VariablePill>
      )
    default:
      return (
        <p
          // FIXME (ogp-weeloong): remove after chakra migration
          style={{ margin: 'revert' }}
          {...attributes}
        >
          {children}
        </p>
      )
  }
}

interface VariablePillProps extends ElementProps {
  element: VariableSlateElement
}

const VariablePill = ({ attributes, children, element }: VariablePillProps) => {
  const selected = useSelected()
  const focused = useFocused()
  const variableLabelMap = React.useContext(VariableLabelMapContext)
  const label = (
    <>
      {variableLabelMap.get(element.placeholderString) ??
        element.placeholderString.slice(2, -2)}
      {children}
    </>
  )
  return (
    <Chip
      {...attributes}
      component="span"
      contentEditable={false}
      style={{
        boxShadow: selected && focused ? '0 0 0 2px #B4D5FF' : 'none',
      }}
      size="small"
      label={label}
    />
  )
}

export default PowerInput
