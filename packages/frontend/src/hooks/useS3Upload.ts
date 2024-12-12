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
import { GENERATE_PRESIGNED_POST } from '@/graphql/mutations/generate-presigned-post'
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
  const [generatePresignedPost] = useMutation(GENERATE_PRESIGNED_POST)
  const [updateFlowConfig] = useMutation(UPDATE_FLOW_CONFIG)
  const [updateStep] = useMutation(UPDATE_STEP)

  const uploadToS3 = async (file: File, flowId: string) => {
    try {
      setIsUploading(true)
      const { name: filename, size, type } = file
      const updatedAt = new Date().toISOString()

      // const res = await generatePresignedUrl({
      //   variables: {
      //     input: {
      //       id: flowId,
      //       filename,
      //       fileType: type,
      //       size,
      //       updatedAt,
      //       manualUpload: true,
      //     },
      //   },
      // })
      // const presignedUrl = res.data?.generatePresignedUrl?.url
      // const s3Id = res.data?.generatePresignedUrl?.s3Id

      // if (!presignedUrl || !s3Id) {
      //   throw new Error('Failed to generate presigned URL')
      // }

      // console.log(uploadRes)
      // const uploadRes = await fetch(presignedUrl, {
      //   method: 'PUT',
      //   body: file,
      //   headers: {
      //     'Content-Type': file.type,
      //   },
      // })

      const resPost = await generatePresignedPost({
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

      const url = resPost.data?.generatePresignedPost?.url
      const fields = resPost.data?.generatePresignedPost?.fields
      const s3Id = resPost.data?.generatePresignedPost?.s3Id

      if (!url || !fields || !s3Id) {
        throw new Error('Failed to generate presigned URL')
      }

      const form = new FormData()
      Object.entries(fields).forEach(([field, value]) => {
        form.append(field, value as string)
      })
      form.append('file', file)

      const uploadRes = await fetch(url, {
        method: 'POST',
        body: form,
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
        status: 'error',
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
