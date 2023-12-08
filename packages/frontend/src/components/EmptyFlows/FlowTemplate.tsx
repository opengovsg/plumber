import { BiRightArrowAlt } from 'react-icons/bi'
import { Box, GridItem, Icon, Text } from '@chakra-ui/react'
import { Link } from '@opengovsg/design-system-react'

export interface FlowTemplateProps {
  title: string
  description: string
  link: string
}

export default function FlowTemplate(props: FlowTemplateProps) {
  const { title, description, link } = props
  return (
    <GridItem gridColumn={{ base: 'span 3', md: 'span 1' }}>
      <Box
        p={6}
        borderRadius="10px"
        border="1px solid"
        borderColor="base.divider.medium"
        h={{ base: '240px', sm: '200px', md: '280px' }}
        position="relative"
      >
        <Text textStyle="subhead-1">{title}</Text>
        <Text textStyle="body-2">{description}</Text>
        <Box position="absolute" bottom={6}>
          <Link
            p={0}
            color="base.content.default"
            variant="standalone"
            target="_blank"
            href={link}
          >
            Set up guide <Icon as={BiRightArrowAlt} />
          </Link>
        </Box>
      </Box>
    </GridItem>
  )
}
