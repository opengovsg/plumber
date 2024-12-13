import { IField, TDataOutMetadatumType } from '@plumber/types'

import { useCallback, useContext, useMemo, useRef, useState } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import Markdown from 'react-markdown'
import { useQuery } from '@apollo/client'
import {
  Box,
  FormControl,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  useDisclosure,
  useOutsideClick,
} from '@chakra-ui/react'
import { FormErrorMessage, FormLabel } from '@opengovsg/design-system-react'

import PrimarySpinner from '@/components/PrimarySpinner'
import Suggestions from '@/components/RichTextEditor/Suggestions'
import { CheckboxVariable } from '@/components/VariablesList/VariableCheckbox'
import { StepExecutionsContext } from '@/contexts/StepExecutions'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import {
  extractVariables,
  filterVariables,
  type Variable,
} from '@/helpers/variables'
import { useS3Delete } from '@/hooks/useS3Delete'
import { useS3Upload } from '@/hooks/useS3Upload'
import { POPOVER_MOTION_PROPS } from '@/theme/constants'

import MenuAlertDialog from '../MenuAlertDialog'

import { boxStyles, divWrapperStyles } from './style'
import Tags from './Tags'
import {
  ACCEPTED_FILE_TYPES,
  AttachmentConfigInput,
  reformatAttachmentsConfig,
  reformatToAttachmentConfig,
  validateFiles,
} from './utils'

interface MultiCheckboxProps {
  name: string
  subFields?: IField[]
  label?: string
  defaultValue?: string
  description?: string
  required?: boolean
  variableTypes?: TDataOutMetadatumType[]
}

function AttachmentMultiCheckbox(props: MultiCheckboxProps) {
  const {
    name,
    required,
    description,
    label,
    variableTypes = null,
    defaultValue,
    subFields,
  } = props

  const cancelRef = useRef<HTMLButtonElement>(null)
  const wrapperRef = useRef(null)
  const { priorExecutionSteps } = useContext(StepExecutionsContext)
  const { control, setError, getValues } = useFormContext()

  const [selectedFile, setSelectedFile] = useState<Variable | null>(null)
  const [selectedOptions, setSelectedOptions] = useState<
    (AttachmentConfigInput | CheckboxVariable)[]
  >([])

  const {
    isOpen: isDialogOpen,
    onOpen: onDialogOpen,
    onClose: onDialogClose,
  } = useDisclosure()

  const {
    isOpen: isSuggestionsOpen,
    onOpen: openSuggestions,
    onClose: closeSuggestions,
  } = useDisclosure()

  const {
    data: flowData,
    loading,
    refetch: refetchFlow,
  } = useQuery(GET_FLOW, {
    variables: { id: getValues('flowId') },
  })

  useOutsideClick({
    ref: wrapperRef,
    handler: () => {
      if (!isDialogOpen && isSuggestionsOpen) {
        closeSuggestions()
      }
    },
  })

  const uploadedItems = useMemo(() => {
    const attachmentsConfig = flowData?.getFlow?.config?.attachments ?? []
    return reformatAttachmentsConfig(attachmentsConfig)
  }, [flowData])

  const items = useMemo(() => {
    const vars = filterVariables(
      extractVariables(priorExecutionSteps),
      (variable: Variable) => {
        const variableType = variable.type ?? 'text'
        return variableTypes?.includes(variableType) ?? false
      },
    )

    if (vars.length === 0) {
      return []
    }

    const newItems =
      vars[0]?.output?.map((v) => {
        const { displayedValue, label, value } = v
        return {
          name: displayedValue,
          label: `${label}: ${displayedValue}`,
          displayedValue,
          type: 'file' as TDataOutMetadatumType,
          order: null,
          value,
        } as CheckboxVariable
      }) || []

    const currentAttachments = getValues(name) || []

    setSelectedOptions([
      ...reformatToAttachmentConfig(
        newItems.filter((v) => currentAttachments.includes(v.value)),
      ),
      ...uploadedItems.filter((f) => currentAttachments.includes(f.value)),
    ])
    return [...newItems]
  }, [getValues, name, priorExecutionSteps, uploadedItems, variableTypes])

  const suggestions = useMemo(() => {
    if (!subFields || subFields.length === 0) {
      return []
    }
    return subFields?.map((field) => {
      const { variables } = field
      return {
        id: field.key,
        name: field.label || '',
        value: field.key,
        output: variables ? items : [...uploadedItems],
        addNew: !variables,
      }
    })
  }, [items, subFields, uploadedItems])

  const { deleteFromS3, isDeleting } = useS3Delete(
    name,
    getValues,
    refetchFlow,
    uploadedItems,
    {
      onError: (filename) => {
        setError(name, {
          type: 'deleteError',
          message: `Failed to delete ${filename}`,
        })
      },
    },
  )

  const { uploadToS3 } = useS3Upload(
    name,
    getValues,
    refetchFlow,
    uploadedItems,
    {
      onError: (filename) => {
        setError(name, {
          type: 'uploadError',
          message: `Failed to upload ${filename}`,
        })
      },
    },
  )

  const handleDelete = async () => {
    await deleteFromS3(selectedFile)
    onDialogClose()
  }

  const onSuggestionClick = (
    variable: CheckboxVariable,
    onChange: (...event: any[]) => void,
    values: any[],
    checked?: boolean,
  ) => {
    const { value } = variable
    const prevValues = values || []
    if (!checked) {
      setSelectedOptions(
        selectedOptions.filter((option) => option.value !== value),
      )
      onChange(prevValues.filter((v: CheckboxVariable) => v !== value))
    } else {
      const { isValid, error } = validateFiles(variable, selectedOptions)
      if (!isValid) {
        setError(name, {
          type: 'invalidFile',
          message: error,
        })
      } else {
        onChange([...prevValues, value])
        setSelectedOptions((prevOptions) => [...prevOptions, variable])
      }
    }
  }

  const onDelete = (e: React.MouseEvent, file: Variable) => {
    e?.stopPropagation()
    onDialogOpen()
    setSelectedFile(file)
  }

  const processFile = useCallback(
    async (file: File) => {
      const flowId = getValues('flowId')
      const { isValid, error } = validateFiles(file, selectedOptions)
      if (!isValid) {
        setError(name, {
          type: 'invalidFile',
          message: error,
        })
      } else {
        await uploadToS3(file, flowId)
      }
    },
    [getValues, name, selectedOptions, setError, uploadToS3],
  )

  return (
    <Controller
      control={control}
      name={name}
      rules={{ required }}
      defaultValue={defaultValue}
      render={({ field: { onChange, value }, fieldState: { error } }) => {
        return (
          <FormControl isInvalid={!!error} ref={wrapperRef}>
            {label && (
              <FormLabel
                isRequired={required}
                style={{ whiteSpace: 'pre-wrap' }}
                description={
                  description && (
                    <Markdown linkTarget="_blank">{description}</Markdown>
                  )
                }
              >
                {label}
              </FormLabel>
            )}
            <Popover
              autoFocus={false}
              gutter={0}
              matchWidth={true}
              isLazy
              lazyBehavior="unmount"
              onClose={closeSuggestions}
              isOpen={isSuggestionsOpen}
              closeOnBlur={false}
            >
              <div style={divWrapperStyles} onClick={openSuggestions}>
                <PopoverTrigger>
                  <Box sx={boxStyles}>
                    <Tags
                      onChange={onChange}
                      values={value}
                      onClick={onSuggestionClick}
                      selectedOptions={selectedOptions}
                    />
                    <Input
                      variant="unstyled"
                      flex="1"
                      readOnly
                      cursor="pointer"
                    />
                    <PopoverContent w="100%" motionProps={POPOVER_MOTION_PROPS}>
                      {loading ? (
                        <PrimarySpinner margin="auto" fontSize="4xl" p="5" />
                      ) : (
                        <Suggestions
                          data={suggestions}
                          onSuggestionClick={(
                            variable: Variable,
                            checked?: boolean,
                          ) => {
                            onSuggestionClick(
                              variable,
                              onChange,
                              value,
                              checked,
                            )
                          }}
                          variableComponentType="checkbox"
                          checkedItems={selectedOptions?.map(
                            (option) => option.value,
                          )}
                          accept={ACCEPTED_FILE_TYPES.join(',')}
                          processFile={processFile}
                          onDelete={onDelete}
                        />
                      )}
                    </PopoverContent>
                  </Box>
                </PopoverTrigger>
              </div>
            </Popover>
            <MenuAlertDialog
              isDialogOpen={isDialogOpen}
              cancelRef={cancelRef}
              onDialogClose={onDialogClose}
              dialogHeader="File"
              dialogType="delete"
              onClick={handleDelete}
              isLoading={isDeleting}
            />
            {error && <FormErrorMessage>{error.message}</FormErrorMessage>}
          </FormControl>
        )
      }}
    />
  )
}

export default AttachmentMultiCheckbox
