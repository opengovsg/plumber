import { createMultiStyleConfigHelpers } from '@chakra-ui/react'
import { anatomy } from '@chakra-ui/theme-tools'

const parts = anatomy('sidebar').parts(
  'item',
  'list',
  'header',
  'label',
  'nest',
  'section',
  'parent',
  'child',
  'icon',
)

const { definePartsStyle, defineMultiStyleConfig } =
  createMultiStyleConfigHelpers(parts.keys)

const baseStyle = definePartsStyle(({ theme }) => {
  return {
    ...theme.components.Sidebar.baseStyle,
    section: {
      py: 4,
    },
  }
})

export const Sidebar = defineMultiStyleConfig({
  baseStyle,
  variants: {
    sticky: {
      section: {
        height: 'auto',
        position: 'sticky',
        top: 0,
      },
    },
  },
})
