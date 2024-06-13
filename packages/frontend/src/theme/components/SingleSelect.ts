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

export const SingleSelect = defineMultiStyleConfig({
  baseStyle,
})
