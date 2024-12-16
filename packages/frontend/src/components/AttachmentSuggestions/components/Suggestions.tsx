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
import { StepWithVariables, Variable } from '@/helpers/variables'
import { POPOVER_MOTION_PROPS } from '@/theme/constants'

import { boxStyles, divWrapperStyles, noVariablesTextStyles } from '../style'
import { ACCEPTED_FILE_TYPES, AttachmentConfigInput } from '../utils'

import Checkbox, { type CheckboxVariable } from './Checkbox'
import TagList from './TagList'

interface SuggestionsProps {
  currentTab: number
  isSuggestionsOpen: boolean
  isUploading: boolean
  loading: boolean
  selectedNames: string[]
  selectedOptions: (CheckboxVariable | AttachmentConfigInput)[]
  suggestions: StepWithVariables[]
  values: any
  closeSuggestions: () => void
  onChange: (...event: any[]) => void
  onDelete: (e: React.MouseEvent, file: Variable) => void
  onSuggestionClick: (
    variable: Variable,
    checked: boolean,
    onChange: (...event: any[]) => void,
    value: any,
  ) => void
  openSuggestions: () => void
  processFile: (file: File) => void
  setCurrentTab: (tab: number) => void
}

export default function Suggestions(props: SuggestionsProps) {
  const {
    currentTab,
    isSuggestionsOpen,
    isUploading,
    loading,
    selectedNames,
    selectedOptions,
    suggestions,
    values,
    closeSuggestions,
    onChange,
    onDelete,
    onSuggestionClick,
    openSuggestions,
    processFile,
    setCurrentTab,
  } = props

  const SuggestionsRightPanel = ({
    onChange,
    values,
  }: {
    onChange: (...event: any[]) => void
    values: any
  }) => {
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
                    disabled={isUploading}
                    loading={isUploading}
                    processFile={processFile}
                  />
                )}
                <Box data-test="attachment-group" maxH={64} overflowY="auto">
                  {output?.map((variable) => (
                    <Checkbox
                      key={variable.name}
                      variable={variable}
                      allowDelete={addNew}
                      isChecked={selectedNames.includes(variable.name)}
                      onClick={(variable, checked) => {
                        onSuggestionClick(variable, checked, onChange, values)
                      }}
                      onDelete={onDelete}
                    />
                  ))}
                </Box>
              </Collapse>
            )
          )
        })}
      </>
    )
  }

  return (
    <ChakraPopover
      autoFocus={false}
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
                onSuggestionClick(option, false, onChange, values)
              }}
              selectedOptions={selectedOptions}
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
                  rightPanel={
                    <SuggestionsRightPanel
                      onChange={onChange}
                      values={values}
                    />
                  }
                />
              )}
            </PopoverContent>
          </Box>
        </PopoverTrigger>
      </div>
    </ChakraPopover>
  )
}
