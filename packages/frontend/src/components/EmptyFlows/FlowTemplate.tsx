import { BiRightArrowAlt } from 'react-icons/bi'
import { Box, GridItem, Icon, Text } from '@chakra-ui/react'
import { Badge, Link } from '@opengovsg/design-system-react'

export interface FlowTemplateProps {
  count: number
  title: string
  description: string
  link: string
}

export default function FlowTemplate(props: FlowTemplateProps) {
  const { count, title, description, link } = props
  return (
    <GridItem gridColumn={{ base: 'span 3', md: 'span 1' }}>
      <Box
        p={6}
        borderRadius="10px"
        border="1px solid"
        borderColor="base.divider.medium"
        h={{ base: '220px', md: '280px' }}
        position="relative"
      >
        <Badge colorScheme="grey" variant="subtle">
          {count} pipes
        </Badge>
        <Text mt={4} textStyle="subhead-1">
          {title}
        </Text>
        <Text textStyle="body-2">{description}</Text>
        <Box position="absolute" bottom={6}>
          <Link
            p={0}
            color="base.content.default"
            variant="standalone"
            target="_blank"
            href={link}
          >
            Set this up <Icon as={BiRightArrowAlt} />
          </Link>
        </Box>
      </Box>
    </GridItem>
  )
}
