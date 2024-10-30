import { createMultiStyleConfigHelpers } from '@chakra-ui/react'
import { anatomy } from '@chakra-ui/theme-tools'

const parts = anatomy('attachment').parts(
  'container',
  'dropzone',
  'icon',
  'fileInfoContainer',
  'fileInfo',
  'fileInfoDescription',
  'fileInfoImage',
  'fileInfoTitle',
  'fileInfoIcon',
  'fileErrorIcon',
  'fileErrorMessage',
)

const { definePartsStyle, defineMultiStyleConfig } =
  createMultiStyleConfigHelpers(parts.keys)

const getDropzoneColors = definePartsStyle(({ colorScheme: c }) => {
  return {
    dropzone: {
      borderColor: `${c}.700`,
      bg: `${c}.100`,
      _hover: {
        bg: `${c}.200`,
      },
      _active: {
        bg: `${c}.200`,
      },
    },
  }
})

const variantOutline = definePartsStyle((props) => {
  const colorProps = getDropzoneColors(props)

  return {
    dropzone: {
      ...colorProps.dropzone,
    },
  }
})

const variants = {
  outline: variantOutline,
}

export const Attachment = defineMultiStyleConfig({
  variants,
})
