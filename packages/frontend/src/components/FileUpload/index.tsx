import { useCallback, useRef } from 'react'
import { BiUpload } from 'react-icons/bi'
import { Button, Input } from '@chakra-ui/react'
import { IconButton } from '@opengovsg/design-system-react'

import PrimarySpinner from '@/components/PrimarySpinner'

interface FileUploadProps {
  accept?: string
  buttonType?: 'iconButton' | 'textButton'
  disabled?: boolean
  loading?: boolean
  processFile?: (file: File) => void
}

export default function FileUpload(props: FileUploadProps) {
  const {
    accept = 'text/plain',
    buttonType = 'iconButton',
    disabled = false,
    loading = false,
    processFile,
  } = props
  const fileUploadRef = useRef<HTMLInputElement | null>(null)

  const onFileChange = useCallback(
    ({ target }: React.ChangeEvent<HTMLInputElement>) => {
      const file = target.files?.[0]
      // Reset file input so the same file selected will trigger this onChange
      // function.
      if (fileUploadRef.current) {
        fileUploadRef.current.value = ''
      }

      if (!file) {
        return
      }

      processFile?.(file)
    },
    [processFile],
  )

  return (
    <>
      <Input
        ref={fileUploadRef}
        name="fileUpload"
        type="file"
        display="none"
        accept={accept}
        onChange={onFileChange}
      />
      {buttonType === 'textButton' ? (
        <Button
          name="openFileUpload"
          variant="clear"
          onClick={() => fileUploadRef.current?.click()}
          gap="3"
          justifyContent="flex-start"
          w="100%"
          isDisabled={disabled}
        >
          {loading ? (
            <>
              <PrimarySpinner color="secondary.content.medium" /> Uploading...
            </>
          ) : (
            <>
              <BiUpload /> Upload
            </>
          )}
        </Button>
      ) : (
        <IconButton
          aria-label="Upload from file"
          variant="outline"
          icon={<BiUpload />}
          onClick={() => fileUploadRef.current?.click()}
          isDisabled={disabled}
        />
      )}
    </>
  )
}
