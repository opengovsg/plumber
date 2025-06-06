import { useContext, useMemo } from 'react'
import {
  Box,
  Collapse,
  Popover as ChakraPopover,
  PopoverContent,
  PopoverTrigger,
  Text,
} from '@chakra-ui/react'

import FileUpload from '@/components/FileUpload'
import PrimarySpinner from '@/components/PrimarySpinner'
import SuggestionsWrapper from '@/components/SuggestionsWrapper'
import { EditorContext } from '@/contexts/Editor'
import { StepWithVariables, Variable } from '@/helpers/variables'
import { POPOVER_MOTION_PROPS } from '@/theme/constants'

import { boxStyles, divWrapperStyles, noVariablesTextStyles } from '../style'
import { ACCEPTED_FILE_TYPES, AttachmentConfigInput } from '../utils'

import Checkbox, { type CheckboxVariable } from './Checkbox'
import TagList from './TagList'

interface SuggestionsProps {
  allOptions: (CheckboxVariable | AttachmentConfigInput)[]
  currentTab: number
  isSuggestionsOpen: boolean
  isUploading: boolean
  loading: boolean
  suggestions: StepWithVariables[]
  values: any
  closeSuggestions: () => void
  onDelete: (e: React.MouseEvent, file: Variable) => void
  onSuggestionClick: (variable: Variable, checked: boolean) => void
  openSuggestions: () => void
  processFile: (file: File) => void
  setCurrentTab: (tab: number) => void
}

export default function Suggestions(props: SuggestionsProps) {
  const {
    allOptions,
    currentTab,
    isSuggestionsOpen,
    isUploading,
    loading,
    suggestions,
    values,
    closeSuggestions,
    onDelete,
    onSuggestionClick,
    openSuggestions,
    processFile,
    setCurrentTab,
  } = props

  const { readOnly } = useContext(EditorContext)

  const SuggestionsRightPanel = ({ values }: { values: any }) => {
    if (suggestions.length === 0) {
      return <Text style={noVariablesTextStyles}>No variables available</Text>
    }

    return (
      <>
        {suggestions.map((option: StepWithVariables, index: number) => {
          const { addNew, output } = option
          return (
            (!!output?.length || addNew) && (
              <Collapse
                key={`primary-attachment-${option.name}`}
                in={currentTab === index}
                unmountOnExit
              >
                {addNew && (
                  <FileUpload
                    accept={ACCEPTED_FILE_TYPES.join(',')}
                    buttonType="textButton"
                    disabled={isUploading || readOnly}
                    loading={isUploading}
                    processFile={processFile}
                  />
                )}
                <Box data-test="attachment-group" maxH={64} overflowY="auto">
                  {output?.map((variable) => {
                    const { name } = variable
                    return (
                      <Checkbox
                        key={name}
                        variable={{
                          ...variable,
                          source: option.name,
                        }}
                        allowDelete={addNew && !readOnly}
                        isChecked={
                          values.includes(name) ||
                          values.includes(`{{${name}}}`)
                        }
                        onClick={(variable, checked) => {
                          !readOnly && onSuggestionClick(variable, checked)
                        }}
                        onDelete={onDelete}
                      />
                    )
                  })}
                </Box>
              </Collapse>
            )
          )
        })}
      </>
    )
  }

  const tags = useMemo(() => {
    return allOptions.filter(
      (option) =>
        values.includes(option.name) || values.includes(`{{${option.name}}}`),
    )
  }, [allOptions, values])

  return (
    <ChakraPopover
      autoFocus={readOnly ? true : false}
      gutter={0}
      matchWidth={true}
      isLazy
      lazyBehavior="unmount"
      closeOnBlur={false}
      isOpen={isSuggestionsOpen}
      onClose={closeSuggestions}
    >
      <div style={divWrapperStyles} onClick={openSuggestions}>
        <PopoverTrigger>
          <Box sx={boxStyles} onClick={openSuggestions}>
            <TagList
              onClick={(option) => {
                !readOnly && onSuggestionClick(option, false)
              }}
              tags={tags}
            />
            <PopoverContent w="100%" motionProps={POPOVER_MOTION_PROPS}>
              {loading ? (
                <PrimarySpinner margin="auto" fontSize="4xl" p="5" />
              ) : (
                <SuggestionsWrapper
                  suggestionType="attachments"
                  leftPanelData={suggestions}
                  currentTab={currentTab}
                  onTabChange={setCurrentTab}
                  rightPanel={<SuggestionsRightPanel values={values} />}
                />
              )}
            </PopoverContent>
          </Box>
        </PopoverTrigger>
      </div>
    </ChakraPopover>
  )
}
