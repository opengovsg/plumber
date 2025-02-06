import { createMultiStyleConfigHelpers, defineStyle } from '@chakra-ui/react'
import { anatomy } from '@chakra-ui/theme-tools'

export const comboboxParts = anatomy('combobox').parts('item')

export const parts = anatomy('singleselect')
  .parts(...comboboxParts.keys)
  .extend('field', 'selected')

const { definePartsStyle, defineMultiStyleConfig } =
  createMultiStyleConfigHelpers(parts.keys)

const itemBaseStyle = defineStyle((props) => {
  // follow 50, 100 instead of 100, 200 just for Plumber
  const { colorScheme: c } = props
  return {
    _selected: {
      bg: `${c}.50`,
    },
    _hover: {
      bg: `${c}.50`,
    },
    _active: {
      bg: `${c}.100 !important`, // to override the hover state
    },
  }
})

const baseStyle = definePartsStyle((props) => {
  const itemStyle = itemBaseStyle(props)
  return {
    item: itemStyle,
  }
})

const borderless = definePartsStyle({
  field: {
    bg: 'utility.ui',
    borderRadius: 'base',
    fontSize: '0.875rem',
    gridArea: '1 / 1 / 2 / 3',
    h: '2.5rem',
    px: '0.75rem',
    textStyle: 'body-2',
    border: 'none!important',
    _focus: {
      border: 'none!important',
      boxShadow: 'none!important',
    },
    _active: {
      border: 'none!important',
      boxShadow: 'none!important',
    },
    _placeholder: {
      color: 'interaction.support.placeholder',
    },
  },
})

export const SingleSelect = defineMultiStyleConfig({
  baseStyle,
  variants: { borderless },
})
