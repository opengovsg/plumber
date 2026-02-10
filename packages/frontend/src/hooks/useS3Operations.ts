import { useState } from 'react'
import { FieldValues, UseFormGetValues } from 'react-hook-form'
import {
  ApolloQueryResult,
  OperationVariables,
  useMutation,
} from '@apollo/client'
import { useToast } from '@opengovsg/design-system-react'

import { type CheckboxVariable } from '@/components/AttachmentSuggestions/components/Checkbox'
import {
  AttachmentConfigInput,
  createUpdateStep,
  reformatToAttachmentConfig,
} from '@/components/AttachmentSuggestions/utils'
import { DELETE_UPLOADED_FILE } from '@/graphql/mutations/delete-uploaded-file'
import { GENERATE_PRESIGNED_POST } from '@/graphql/mutations/generate-presigned-post'
import { UPDATE_FLOW_CONFIG } from '@/graphql/mutations/update-flow-config'
import { UPDATE_STEP } from '@/graphql/mutations/update-step'
import { GET_FLOW } from '@/graphql/queries/get-flow'

interface UseS3UploadOptions {
  onError?: (filename: string, type: string, errorMessage: string) => void
  onSuccess?: (filename: string) => void
}

export const useS3Operations = (
  name: string,
  getValues: UseFormGetValues<FieldValues>,
  refetchFlow: (
    variables?: Partial<OperationVariables> | undefined,
  ) => Promise<ApolloQueryResult<any>>,
  uploadedFiles: CheckboxVariable[],
  options: UseS3UploadOptions = {},
) => {
  const toast = useToast()
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [deleteFile] = useMutation(DELETE_UPLOADED_FILE)
  const [generatePresignedPost] = useMutation(GENERATE_PRESIGNED_POST, {
    refetchQueries: [GET_FLOW],
  })
  const [updateFlowConfig] = useMutation(UPDATE_FLOW_CONFIG)
  const [updateStep] = useMutation(UPDATE_STEP)

  const getConfigInput = (
    flowId: string,
    attachments: AttachmentConfigInput[],
  ) => {
    return {
      variables: {
        input: {
          id: flowId,
          attachments: attachments,
        },
      },
    }
  }

  const deleteUploadedFile = async (file: any) => {
    try {
      const { name: filename, value, displayedValue } = file
      const flow = getValues('flow')
      const { id: flowId, updatedAt: flowUpdatedAt } = flow
      setIsDeleting(true)

      // NOTE: this is to ensure all changes are saved before deleting a file
      // to prevent data loss. If a user fills in fields and deletes a file
      // before clicking "Continue," the file would be deleted, but other
      // inputs remain visible in the UI without being saved.
      const currentAttachments = getValues(name) || []
      const mutationInput = createUpdateStep(getValues(), currentAttachments)
      await updateStep({ variables: { input: mutationInput } })

      await deleteFile({
        variables: { id: value, flowUpdatedAt },
      })

      await updateFlowConfig(
        getConfigInput(flowId, [
          ...reformatToAttachmentConfig(
            uploadedFiles.filter((f) => f.value !== value),
          ),
        ]),
      )

      await refetchFlow()

      triggerToast(`${displayedValue} deleted successfully`, 'success')
      setIsDeleting(false)
      options.onSuccess?.(filename)
      return true
    } catch (error) {
      console.error('Error deleting file:', error)
      triggerToast(`Failed to delete file`, 'error')
      setIsDeleting(false)
      const errorMessage = error instanceof Error ? error.message : ''
      options.onError?.('file', 'deleteError', errorMessage)
      return false
    }
  }

  const uploadToS3 = async (
    file: File,
    flowId: string,
    flowUpdatedAt: string,
  ) => {
    try {
      setIsUploading(true)
      const { name: filename, size, type } = file
      const updatedAt = new Date().toISOString()

      const res = await generatePresignedPost({
        variables: {
          input: {
            filename,
            fileType: type,
            size,
            updatedAt,
            flow: {
              id: flowId,
              updatedAt: flowUpdatedAt,
            },
          },
        },
      })
      const presignedPost = res.data?.generatePresignedPost?.presignedPost
      const s3Id = res.data?.generatePresignedPost?.s3Id

      if (!presignedPost || !s3Id) {
        throw new Error('Failed to generate presigned URL')
      }

      const formData = new FormData()
      Object.entries(presignedPost.fields).forEach(([key, value]) => {
        if (value === null) {
          return
        }
        formData.append(key, value as string)
      })
      formData.set('Content-Type', file.type)
      formData.set('file', file)

      const uploadResponse = await fetch(presignedPost.url, {
        method: 'POST',
        body: formData,
      })

      if (uploadResponse.ok) {
        await updateFlowConfig(
          getConfigInput(flowId, [
            // newest file first
            {
              name: s3Id,
              displayedValue: filename,
              value: s3Id,
              size,
              updatedAt,
            },
            ...reformatToAttachmentConfig(uploadedFiles),
          ]),
        )

        const currentAttachments = getValues(name) || []
        const mutationInput = createUpdateStep(getValues(), [
          ...currentAttachments,
          s3Id,
        ])

        await updateStep({
          variables: { input: mutationInput },
        })

        await refetchFlow()
        triggerToast(`${filename} uploaded successfully`, 'success')
        setIsUploading(false)
        options.onSuccess?.(filename)
        return {
          success: true,
          key: presignedPost.fields.key,
          url: `${presignedPost.url}${presignedPost.fields.key}`,
        }
      } else {
        throw new Error('Failed to upload file')
      }
    } catch (error) {
      console.error('Error uploading to S3: ', error)
      triggerToast(`Failed to upload ${file.name}`, 'error')
      setIsUploading(false)
      const errorMessage = error instanceof Error ? error.message : ''
      options.onError?.(file.name, 'uploadError', errorMessage)
    }
  }

  const triggerToast = (title: string, status: 'success' | 'error') => {
    toast({
      title,
      status,
      duration: 3000,
      isClosable: true,
      position: 'top',
    })
  }

  return { deleteUploadedFile, isDeleting, uploadToS3, isUploading }
}
