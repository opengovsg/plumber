import { ReactElement } from 'react'
import { Stack, Text } from '@chakra-ui/react'

type NoResultFoundProps = {
  description: string
  action?: string
}

export default function NoResultFound(props: NoResultFoundProps): ReactElement {
  const { description, action } = props

  return (
    <Stack mt={24} justifyContent="center" alignItems="center" gap={2}>
      <Text textStyle="subhead-1">{description}</Text>
      <Text>{action}</Text>
    </Stack>
  )
}
