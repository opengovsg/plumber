import * as React from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { Badge, FormControl, Text } from '@chakra-ui/react'
import ClickAwayListener from '@mui/base/ClickAwayListener'
import Popper from '@mui/material/Popper'
import { FormLabel } from '@opengovsg/design-system-react'
import { StepExecutionsContext } from 'contexts/StepExecutions'
import { createEditor } from 'slate'
import { Editable, RenderElementProps, Slate } from 'slate-react'

import {
  extractVariables,
  filterVariables,
  StepWithVariables,
  Variable,
} from '../../helpers/variables'

import { FakeInput } from './style'
import Suggestions from './Suggestions'
import { CustomElement, VariableElement } from './types'
import {
  customizeEditor,
  deserialize,
  genVariableInfoMap,
  insertVariable,
  serialize,
  VariableInfoMap,
} from './utils'

// FIXME (ogp-weeloong): Refactor this to something cleaner later...
const VariableInfoMapContext = React.createContext<VariableInfoMap>(new Map())

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
  const renderElement = React.useCallback(
    (props: RenderElementProps) => <Element {...props} />,
    [],
  )
  const editor = React.useMemo(() => customizeEditor(createEditor()), [])
  const [showVariableSuggestions, setShowVariableSuggestions] =
    React.useState(false)

  const [stepsWithVariables, variableInfoMap] = React.useMemo(() => {
    const stepsWithVars = filterVariables(
      extractVariables(priorStepsWithExecutions),
      (variable) => (variable.type ?? 'text') === 'text',
    )
    const info = genVariableInfoMap(stepsWithVars)
    return [stepsWithVars, info]
  }, [priorStepsWithExecutions])

  const handleBlur = React.useCallback(
    (value: any) => {
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

  const handleFocus = React.useCallback(
    () => setShowVariableSuggestions(true),
    [setShowVariableSuggestions],
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
          value,
          onChange: controllerOnChange,
          onBlur: controllerOnBlur,
        },
      }) => (
        <FormControl>
          <Slate
            editor={editor}
            value={deserialize(value)}
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
              <div
                style={{ width: '100%' }}
                data-test="power-input"
                ref={editorRef}
              >
                <FakeInput disabled={disabled}>
                  <VariableInfoMapContext.Provider value={variableInfoMap}>
                    <Editable
                      placeholder={placeholder}
                      readOnly={disabled}
                      style={{ width: '100%' }}
                      renderElement={renderElement}
                      // FIXME (ogp-weeloong): Hackfix for GSIB. Will migrate to chakra for long-term fix.
                      onMouseDown={handleFocus}
                      onFocus={handleFocus}
                      onBlur={() => {
                        controllerOnBlur()
                        handleBlur(value)
                      }}
                    />
                  </VariableInfoMapContext.Provider>
                </FakeInput>

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
      // Allow (ugly) scrolling in nested modals for small viewports; modals
      // can't account for popper overflow if it is portalled to body.
      disablePortal
      style={{
        width: anchorEl?.clientWidth,
        // FIXME (ogp-weeloong): HACKY, temporary workaround. Needed to render
        // sugestions within nested editors, since Chakra renders modals at 40
        // z-index. Will migrate to chakra Popover in separate PR if team is
        // agreeable to flip change.
        zIndex: 40,
      }}
      modifiers={[
        {
          name: 'flip',
          enabled: true,
        },
      ]}
    >
      <Suggestions data={data} onSuggestionClick={onSuggestionClick} />
    </Popper>
  )
}

interface ElementProps extends RenderElementProps {
  children: React.ReactNode
  element: CustomElement
}

const Element = (props: ElementProps) => {
  const { attributes, children, element } = props

  switch (element.type) {
    case 'variable':
      // Not spreading props - TS can't figure out that type has already been
      // narrowed.
      return (
        <VariableBadge attributes={attributes} element={element}>
          {children}
        </VariableBadge>
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

interface VariableBadgeProps extends RenderElementProps {
  element: VariableElement
}

const VariableBadge = ({
  element,

  // We need to forward attributes and children for slate to work.
  attributes,
  children,
}: VariableBadgeProps) => {
  const variableInfo = React.useContext(VariableInfoMapContext).get(
    element.value,
  )

  const label = variableInfo?.label ?? element.value
  const testRunValue = variableInfo?.testRunValue

  return (
    <Badge variant="solid" bg="primary.100" borderRadius="50px" {...attributes}>
      <Text color="base.content.strong">{label}</Text>
      {testRunValue && (
        <Text isTruncated maxW="50ch" color="base.content.medium" ml={1}>
          {testRunValue}
        </Text>
      )}
      {children}
    </Badge>
  )
}

export default PowerInput
