import { TDataOutMetadatumType } from '@plumber/types'

import { memo, useCallback, useContext, useRef, useState } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import Markdown from 'react-markdown'
import { useQuery } from '@apollo/client'
import { FormControl, useDisclosure, useOutsideClick } from '@chakra-ui/react'
import { FormErrorMessage, FormLabel } from '@opengovsg/design-system-react'

import { EditorContext } from '@/contexts/Editor'
import { StepExecutionsContext } from '@/contexts/StepExecutions'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import { type Variable } from '@/helpers/variables'
import { useS3Operations } from '@/hooks/useS3Operations'

import MenuAlertDialog from '../MenuAlertDialog'

import { CheckboxVariable } from './components/Checkbox'
import Suggestions from './components/Suggestions'
import { useAttachmentOptions } from './hooks/useAttachmentOptions'
import { validateFiles, validateFileSize } from './utils'

interface AttachmentSuggestionsProps {
  name: string
  label?: string
  defaultValue?: string
  description?: string
  required?: boolean
  variableTypes?: TDataOutMetadatumType[]
  maxFiles?: number
  disableUpload?: boolean
}

function AttachmentSuggestions(props: AttachmentSuggestionsProps) {
  const {
    name,
    required,
    description,
    label,
    variableTypes = null,
    defaultValue = [],
    maxFiles,
    disableUpload,
  } = props
  const { priorExecutionSteps } = useContext(StepExecutionsContext)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const wrapperRef = useRef(null)
  const { flow } = useContext(EditorContext)
  const { control, setError, getValues } = useFormContext()
  const [currentTab, setCurrentTab] = useState<number>(0)
  const [selectedFile, setSelectedFile] = useState<Variable | null>(null)

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
    variables: { id: flow.id },
  })

  const { options, suggestions, uploadedItems } = useAttachmentOptions(
    flowData?.getFlow?.config,
    priorExecutionSteps,
    variableTypes,
    disableUpload,
  )

  const onSuggestionClick = useCallback(
    (
      variable: CheckboxVariable,
      checked: boolean,
      onChange: (value: any) => void,
    ) => {
      // NOTE: we use name instead of value to accommodate variables
      // We also add curly braces to check for attachments that are variables
      const { name: filename, uploaded } = variable
      const nameToCheck = uploaded ? filename : `{{${filename}}}`

      // NOTE: if the attachment has been deleted from the form
      // it also needs to be removed from the step parameters
      const optionsWithVariables = options.map((o) =>
        o.name.startsWith('s3:') ? o.name : `{{${o.name}}}`,
      )
      const currentValues = (getValues(name) ?? []).filter((v: string) =>
        optionsWithVariables.includes(v),
      )

      if (!checked) {
        onChange?.(currentValues.filter((v: string) => v !== nameToCheck))
      } else {
        const { isValid, error } = validateFiles(
          variable,
          options,
          getValues(name),
          maxFiles,
        )
        if (!isValid) {
          setError(name, { type: 'invalidFile', message: error })
        } else {
          onChange?.(currentValues.concat(nameToCheck))
        }
      }
    },
    [getValues, name, setError, options, maxFiles],
  )

  useOutsideClick({
    ref: wrapperRef,
    handler: () => {
      if (!isDialogOpen && isSuggestionsOpen) {
        closeSuggestions()
      }
    },
  })

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
      /**
       * when uploading the file, we only need to validate the file size.
       * the total number of files and total size of files are validated when users make
       * their selection via the suggestions component.
       */
      const { isValid, error } = validateFileSize(file)
      if (!isValid) {
        setError(name, { type: 'invalidFile', message: error })
      } else {
        await uploadToS3(file, flow.id, flow.updatedAt)
      }
    },
    [flow.id, flow.updatedAt, name, setError, uploadToS3],
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
              allOptions={options}
              currentTab={currentTab}
              isSuggestionsOpen={isSuggestionsOpen}
              isUploading={isUploading}
              loading={loading}
              suggestions={suggestions}
              values={values}
              closeSuggestions={closeSuggestions}
              onDelete={onDelete}
              onSuggestionClick={(variable, checked) =>
                onSuggestionClick(variable, checked, onChange)
              }
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
