import { Stack, Text } from '@chakra-ui/react'

export default function InvalidTemplatePage() {
  // TODO (mal): check if this needs to be beautified
  return (
    <Stack mt={24} justifyContent="center" alignItems="center" gap={2}>
      <Text textStyle="subhead-1">
        Template not found, please refer to our templates page!
      </Text>
    </Stack>
  )
}
