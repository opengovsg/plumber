import { useState } from 'react'
import { FieldValues, UseFormGetValues } from 'react-hook-form'
import {
  ApolloQueryResult,
  OperationVariables,
  useMutation,
} from '@apollo/client'
import { useToast } from '@opengovsg/design-system-react'

import {
  createUpdateStep,
  reformatToAttachmentConfig,
} from '@/components/AttachmentMultiCheckbox/utils'
import { CheckboxVariable } from '@/components/VariablesList/VariableCheckbox'
import { GENERATE_PRESIGNED_URL } from '@/graphql/mutations/generate-presigned-url'
import { UPDATE_FLOW_CONFIG } from '@/graphql/mutations/update-flow-config'
import { UPDATE_STEP } from '@/graphql/mutations/update-step'

interface UseS3UploadOptions {
  onError?: (filename: string) => void
  onSuccess?: (filename: string) => void
}

export const useS3Upload = (
  name: string,
  getValues: UseFormGetValues<FieldValues>,
  refetchFlow: (
    variables?: Partial<OperationVariables> | undefined,
  ) => Promise<ApolloQueryResult<any>>,
  uploadedFiles: CheckboxVariable[],
  options: UseS3UploadOptions = {},
) => {
  const toast = useToast()
  const [isUploading, setIsUploading] = useState(false)
  const [generatePresignedUrl] = useMutation(GENERATE_PRESIGNED_URL)
  const [updateFlowConfig] = useMutation(UPDATE_FLOW_CONFIG)
  const [updateStep] = useMutation(UPDATE_STEP)

  const uploadToS3 = async (file: File, flowId: string) => {
    try {
      setIsUploading(true)
      const { name: filename, size } = file
      const updatedAt = new Date().toISOString()

      const res = await generatePresignedUrl({
        variables: {
          input: {
            id: flowId,
            filename,
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

      await updateFlowConfig({
        variables: {
          input: {
            id: flowId,
            attachments: [
              // newest file first
              {
                name: filename,
                value: s3Id,
                size,
                updatedAt,
              },
              ...reformatToAttachmentConfig(uploadedFiles),
            ],
          },
        },
      })

      const currentAttachments = getValues(name) || []
      const mutationInput = createUpdateStep(getValues(), [
        ...currentAttachments,
        s3Id,
      ])

      await updateStep({
        variables: { input: mutationInput },
      })

      await refetchFlow()
      toast({
        title: `${filename} uploaded successfully`,
        status: 'success',
        duration: 3000,
        isClosable: true,
        position: 'top',
      })
      setIsUploading(false)
      options.onSuccess?.(filename)
    } catch (error) {
      console.error('Error uploading to S3: ', error)
      toast({
        title: `Failed to upload ${file.name}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
        position: 'top',
      })
      setIsUploading(false)
      options.onError?.(file.name)
    }
  }

  return { uploadToS3, isUploading }
}
