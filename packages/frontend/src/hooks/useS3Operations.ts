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
import { DELETE_FROM_S3 } from '@/graphql/mutations/delete-from-s3'
import { GENERATE_PRESIGNED_URL } from '@/graphql/mutations/generate-presigned-url'
import { UPDATE_FLOW_CONFIG } from '@/graphql/mutations/update-flow-config'
import { UPDATE_STEP } from '@/graphql/mutations/update-step'

interface UseS3UploadOptions {
  onError?: (filename: string, type: string) => void
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
  const [deleteFile] = useMutation(DELETE_FROM_S3)
  const [generatePresignedUrl] = useMutation(GENERATE_PRESIGNED_URL)
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

  const deleteFromS3 = async (file: any) => {
    try {
      const { name: filename, value } = file
      const flowId = getValues('flowId')
      setIsDeleting(true)
      await deleteFile({ variables: { id: value } })

      await updateFlowConfig(
        getConfigInput(flowId, [
          ...reformatToAttachmentConfig(
            uploadedFiles.filter((f) => f.value !== value),
          ),
        ]),
      )

      await refetchFlow()

      triggerToast(`${filename} deleted successfully`, 'success')
      setIsDeleting(false)
      options.onSuccess?.(filename)
      return true
    } catch (error) {
      console.error('Error deleting file:', error)
      triggerToast(`Failed to delete ${file.name}`, 'error')
      setIsDeleting(false)
      options.onError?.(file.name, 'deleteError')
      return false
    }
  }

  const uploadToS3 = async (file: File, flowId: string) => {
    try {
      setIsUploading(true)
      const { name: filename, size, type } = file
      const updatedAt = new Date().toISOString()

      const res = await generatePresignedUrl({
        variables: {
          input: {
            id: flowId,
            filename,
            fileType: type,
            size,
            updatedAt,
            manualUpload: true,
          },
        },
      })
      const presignedUrl = res.data?.generatePresignedUrl?.url
      const s3Id = res.data?.generatePresignedUrl?.s3Id

      if (!presignedUrl || !s3Id) {
        throw new Error('Failed to generate presigned URL')
      }

      const uploadRes = await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      })

      if (!uploadRes.ok) {
        throw new Error(
          `Upload failed: ${uploadRes.status} ${uploadRes.statusText}`,
        )
      }

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
    } catch (error) {
      console.error('Error uploading to S3: ', error)
      triggerToast(`Failed to upload ${file.name}`, 'error')
      setIsUploading(false)
      options.onError?.(file.name, 'uploadError')
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

  return { deleteFromS3, isDeleting, uploadToS3, isUploading }
}
