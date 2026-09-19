import type { IFieldTabs } from '@plumber/types'

import { useContext } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import {
  Box,
  FormControl,
  Tab,
  TabList,
  type TabProps,
  Tabs,
} from '@chakra-ui/react'
import { FormLabel } from '@opengovsg/design-system-react'

import { EditorContext } from '@/contexts/Editor'

interface TabbedInputProps {
  // Full react-hook-form path of the tab parameter, not of the input itself.
  name: string
  label?: string
  required?: boolean
  tooltipText?: string
  tabs: IFieldTabs
  children: React.ReactNode
}

// Segmented pill: grey track, white selected pill, dark text throughout.
const tabStyle: TabProps = {
  _selected: {
    color: 'base.content.strong',
    bg: 'white',
    boxShadow: 'sm',
  },
  _hover: {
    color: 'base.content.strong',
  },
  color: 'base.content.default',
  bg: 'transparent',
  letterSpacing: '0',
  fontWeight: 'normal',
  textTransform: 'none',
  borderRadius: 'full',
  border: 'none',
  px: 4,
  py: 1,
  textStyle: 'body-2',
  whiteSpace: 'nowrap',
}

/**
 * Wraps a text input with a pill toggle describing how the input will be used.
 *
 * Owns the label and description so the inner input renders neither. The
 * selected pill is stored under its own parameter key, which keeps the input's
 * stored value backwards compatible when a toggle is added to an existing field.
 */
export default function TabbedInput(props: TabbedInputProps) {
  const { name, label, required, tooltipText, tabs, children } = props
  const { control } = useFormContext()
  const { readOnly } = useContext(EditorContext)

  return (
    <Controller
      name={name}
      control={control}
      defaultValue={tabs.value}
      render={({ field: { onChange, value } }) => {
        // An unrecognised or missing value falls back to the first tab so the
        // control is never rendered with nothing selected.
        const selectedIndex = Math.max(
          tabs.options.findIndex((option) => option.value === value),
          0,
        )
        const { description } = tabs.options[selectedIndex]

        return (
          <FormControl>
            {label && (
              <FormLabel isRequired={required} tooltipText={tooltipText} mb={2}>
                {label}
              </FormLabel>
            )}

            <Tabs
              variant="unstyled"
              index={selectedIndex}
              onChange={(index) =>
                !readOnly && onChange(tabs.options[index].value)
              }
              bg="base.divider.medium"
              p={1}
              borderRadius="full"
              w="fit-content"
              maxW="100%"
              mb={2}
            >
              <TabList gap={1} overflowX="auto">
                {tabs.options.map((option) => (
                  <Tab key={option.value} {...tabStyle}>
                    {option.label}
                  </Tab>
                ))}
              </TabList>
            </Tabs>

            {description && (
              <FormLabel.Description whiteSpace="pre-wrap">
                {description}
              </FormLabel.Description>
            )}

            <Box mt={2}>{children}</Box>
          </FormControl>
        )
      }}
    />
  )
}
