import type { IJSONValue, IPreset, TRteMenuOption } from '@plumber/types'

import { useContext, useMemo, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { Box, Divider, Flex, Text } from '@chakra-ui/react'
import { FormLabel } from '@opengovsg/design-system-react'

import RichTextEditor from '@/components/RichTextEditor'
import { EditorContext } from '@/contexts/Editor'

interface RichTextEditorWithPresetsProps {
  name: string
  basePath?: string
  presets: IPreset[]
  required?: boolean
  label?: string
  description?: string
  placeholder?: string
  variablesEnabled?: boolean
  noVariablesMessage?: string
  customRteMenuOptions?: TRteMenuOption[]
  defaultValue?: string | IJSONValue
}

const isEditorValueEmpty = (value?: string) => {
  if (!value) {
    return true
  }

  const normalized = value
    .replace(/<br\s*\/?>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .trim()
  return normalized.length === 0
}

export default function RichTextEditorWithPresets({
  name,
  basePath,
  presets,
  required,
  label,
  description,
  placeholder,
  variablesEnabled,
  noVariablesMessage,
  customRteMenuOptions,
  defaultValue,
}: RichTextEditorWithPresetsProps): JSX.Element {
  const { setValue, watch } = useFormContext()
  const { readOnly } = useContext(EditorContext)
  const [editorVersion, setEditorVersion] = useState(0)

  const editorValue = watch(name) as string | undefined
  const showPresets = useMemo(
    () => isEditorValueEmpty(editorValue),
    [editorValue],
  )

  const handleSelectPreset = (preset: IPreset) => {
    if (readOnly) {
      return
    }

    for (const assignment of preset.assignments) {
      const targetFieldPath = basePath
        ? `${basePath}.${assignment.fieldKey}`
        : assignment.fieldKey
      setValue(targetFieldPath, assignment.value, {
        shouldDirty: true,
        shouldValidate: true,
      })
    }
    // Re-mount editor so Tiptap reflects the new externally-driven value.
    setEditorVersion((version) => version + 1)
  }

  return (
    <Box>
      {label && (
        <FormLabel
          isRequired={required}
          description={description}
          style={{ whiteSpace: 'pre-wrap' }}
        >
          {label}
        </FormLabel>
      )}

      <Box
        border="1px solid rgba(0, 0, 0, 0.23)"
        borderRadius="md"
        overflow="hidden"
        _focusWithin={{
          borderColor: 'primary.500',
          boxShadow: '0 0 0 1px var(--chakra-colors-primary-500)',
        }}
      >
        <Flex align="stretch" direction={{ base: 'column', lg: 'row' }}>
          <Box flex={1} display="flex">
            <RichTextEditor
              key={`${name}-${editorVersion}`}
              required={required}
              name={name}
              placeholder={placeholder}
              variablesEnabled={variablesEnabled}
              isRich
              noVariablesMessage={noVariablesMessage}
              customRteMenuOptions={customRteMenuOptions}
              defaultValue={defaultValue}
              containerClassName="editor--borderless"
              triggerContainerClassName="editor-with-presets__trigger"
            />
          </Box>

          {showPresets && presets.length > 0 && (
            <Box
              w={{ base: '100%', lg: '24rem' }}
              maxW="24rem"
              bg="white"
              borderTopWidth={{ base: '1px', lg: 0 }}
              borderLeftWidth={{ base: 0, lg: '1px' }}
              borderColor="base.divider.subtle"
            >
              {presets.map((preset, index) => (
                <Box key={preset.key}>
                  <Box
                    px={4}
                    py={3}
                    role="button"
                    cursor={readOnly ? 'not-allowed' : 'pointer'}
                    onClick={() => handleSelectPreset(preset)}
                    opacity={readOnly ? 0.6 : 1}
                    _hover={
                      readOnly
                        ? undefined
                        : {
                            bg: 'primary.50',
                          }
                    }
                  >
                    <Text textStyle="caption-1">{preset.label}</Text>
                    <Text textStyle="caption-2">{preset.description}</Text>
                  </Box>
                  {index < presets.length - 1 && <Divider />}
                </Box>
              ))}
            </Box>
          )}
        </Flex>
      </Box>
    </Box>
  )
}
