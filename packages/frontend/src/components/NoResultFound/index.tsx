import { Stack, Text } from '@chakra-ui/react'
import { ReactElement } from 'react'

type NoResultFoundProps = {
  description: string
  action?: string
}

export default function NoResultFound(props: NoResultFoundProps): ReactElement {
  const { description, action } = props

  return (
    <Stack mt={24} justifyContent="center" alignItems="center" gap={1}>
      <Text textStyle="subhead-1">{description}</Text>
      <Text textStyle="body-2" color="base.content.medium">
        {action}
      </Text>
    </Stack>
  )
}
