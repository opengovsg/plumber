import { TDataOutMetadatumType } from '@plumber/types'

import { memo, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import Markdown from 'react-markdown'
import { useQuery } from '@apollo/client'
import { FormControl, useDisclosure, useOutsideClick } from '@chakra-ui/react'
import { FormErrorMessage, FormLabel } from '@opengovsg/design-system-react'

import { StepExecutionsContext } from '@/contexts/StepExecutions'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import {
  extractVariables,
  filterVariables,
  type Variable,
} from '@/helpers/variables'
import { useS3Operations } from '@/hooks/useS3Operations'

import MenuAlertDialog from '../MenuAlertDialog'

import { CheckboxVariable } from './components/Checkbox'
import Suggestions from './components/Suggestions'
import { useAttachmentSelection } from './hooks/useAttachmentSelection'
import { reformatToCheckboxVariables, validateFiles } from './utils'

interface AttachmentSuggestionsProps {
  name: string
  label?: string
  defaultValue?: string
  description?: string
  required?: boolean
  variableTypes?: TDataOutMetadatumType[]
}

function AttachmentSuggestions(props: AttachmentSuggestionsProps) {
  const {
    name,
    required,
    description,
    label,
    variableTypes = null,
    defaultValue,
  } = props
  const { priorExecutionSteps } = useContext(StepExecutionsContext)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const wrapperRef = useRef(null)
  const { control, setError, getValues } = useFormContext()
  const [currentTab, setCurrentTab] = useState<number>(0)

  const flowId = getValues('flowId')

  const {
    selectedOptions,
    setSelectedOptions,
    selectedFile,
    setSelectedFile,
    onSuggestionClick,
  } = useAttachmentSelection(setError)

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
    variables: { id: flowId },
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
    return reformatToCheckboxVariables(attachmentsConfig)
  }, [flowData])

  const suggestions = useMemo(() => {
    const selectedNames = getValues(name)

    const filteredVars = filterVariables(
      extractVariables(priorExecutionSteps),
      (variable: Variable) => {
        const variableType = variable.type ?? 'text'
        return variableTypes?.includes(variableType) ?? false
      },
    )

    const selectedFromVars = filteredVars.reduce(
      (acc: CheckboxVariable[], v) => {
        const { output } = v
        acc.push(
          ...output.filter((item: CheckboxVariable) => {
            if (item.uploaded) {
              return selectedNames?.includes(item.displayedValue)
            }

            return selectedNames?.includes(`{{${item.name}}}`)
          }),
        )
        return acc
      },
      [],
    )

    setSelectedOptions([
      ...selectedFromVars,
      ...uploadedItems.filter((item) => selectedNames?.includes(item.name)),
    ])
    return [
      ...filteredVars,
      {
        id: 'uploaded',
        name: 'Uploaded attachments',
        output: uploadedItems,
        addNew: true,
      },
    ]
  }, [
    getValues,
    name,
    priorExecutionSteps,
    setSelectedOptions,
    uploadedItems,
    variableTypes,
  ])

  const selectedNames = useMemo(() => {
    return selectedOptions.map((option) => option.name as string)
  }, [selectedOptions])

  const { deleteUploadedFile, isDeleting, uploadToS3, isUploading } =
    useS3Operations(name, getValues, refetchFlow, uploadedItems, {
      onError: (filename: string, type: string, errorMessage: string) => {
        setError(name, {
          type: type,
          message: `Failed to ${
            type === 'uploadError' ? 'upload' : 'delete'
          } ${filename}. ${errorMessage}`,
        })
      },
    })

  const onDelete = (e: React.MouseEvent, file: Variable) => {
    e?.stopPropagation()
    onDialogOpen()
    setSelectedFile(file)
  }

  const onDeleteConfirm = async () => {
    await deleteUploadedFile(selectedFile)
    onDialogClose()
  }

  const processFile = useCallback(
    async (file: File) => {
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
    [flowId, name, selectedOptions, setError, uploadToS3],
  )

  return (
    <Controller
      control={control}
      name={name}
      rules={{ required }}
      defaultValue={defaultValue}
      render={({
        field: { onChange, value: values },
        fieldState: { error },
      }) => {
        console.log('error', error)
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
            <Suggestions
              currentTab={currentTab}
              isSuggestionsOpen={isSuggestionsOpen}
              isUploading={isUploading}
              loading={loading}
              selectedNames={selectedNames}
              selectedOptions={selectedOptions}
              suggestions={suggestions}
              values={values}
              closeSuggestions={closeSuggestions}
              onChange={onChange}
              onDelete={onDelete}
              onSuggestionClick={onSuggestionClick}
              openSuggestions={openSuggestions}
              processFile={processFile}
              setCurrentTab={setCurrentTab}
            />
            <MenuAlertDialog
              cancelRef={cancelRef}
              dialogHeader="File"
              dialogType="delete"
              isDialogOpen={isDialogOpen}
              isLoading={isDeleting}
              onClick={onDeleteConfirm}
              onDialogClose={onDialogClose}
            />
            {error && <FormErrorMessage>{error.message}</FormErrorMessage>}
          </FormControl>
        )
      }}
    />
  )
}

export default memo(AttachmentSuggestions)
