import { useState } from 'react'
import { FieldValues, UseFormGetValues } from 'react-hook-form'
import {
  ApolloQueryResult,
  OperationVariables,
  useMutation,
} from '@apollo/client'
import { useToast } from '@opengovsg/design-system-react'

import { reformatToAttachmentConfig } from '@/components/AttachmentMultiCheckbox/utils'
import { CheckboxVariable } from '@/components/VariablesList/VariableCheckbox'
import { DELETE_FROM_S3 } from '@/graphql/mutations/delete-from-s3'
import { UPDATE_FLOW_CONFIG } from '@/graphql/mutations/update-flow-config'

interface UseS3DeleteOptions {
  onError?: (filename: string) => void
  onSuccess?: (filename: string) => void
}

export const useS3Delete = (
  name: string,
  getValues: UseFormGetValues<FieldValues>,
  refetchFlow: (
    variables?: Partial<OperationVariables> | undefined,
  ) => Promise<ApolloQueryResult<any>>,
  uploadedFiles: CheckboxVariable[],
  options: UseS3DeleteOptions = {},
) => {
  const toast = useToast()
  const [deleteFile] = useMutation(DELETE_FROM_S3)
  const [updateFlowConfig] = useMutation(UPDATE_FLOW_CONFIG)
  const [isDeleting, setIsDeleting] = useState(false)

  const deleteFromS3 = async (file: any) => {
    try {
      const { name: filename, value } = file
      const flowId = getValues('flowId')
      setIsDeleting(true)
      await deleteFile({ variables: { id: value } })

      await updateFlowConfig({
        variables: {
          input: {
            id: flowId,
            attachments: [
              ...reformatToAttachmentConfig(
                uploadedFiles.filter((f) => f.value !== value),
              ),
            ],
          },
        },
      })

      await refetchFlow()

      toast({
        title: `${filename} deleted successfully`,
        status: 'success',
        duration: 3000,
        isClosable: true,
        position: 'top',
      })
      setIsDeleting(false)
      options.onSuccess?.(filename)
      return true
    } catch (error) {
      console.error('Error deleting file:', error)
      toast({
        title: `Failed to delete ${file.name}`,
        status: 'error',
        duration: 3000,
        isClosable: true,
        position: 'top',
      })
      setIsDeleting(false)
      console.error('Error deleting file: ', error)
      options.onError?.(file.name)
      return false
    }
  }

  return { deleteFromS3, isDeleting }
}
