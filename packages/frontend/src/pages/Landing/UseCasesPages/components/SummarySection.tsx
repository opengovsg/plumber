import { BiSolidCheckCircle } from 'react-icons/bi'
import {
  Box,
  Flex,
  Heading,
  List,
  ListIcon,
  ListItem,
  Text,
} from '@chakra-ui/react'

import Container from '@/components/Container'

import BackgroundPattern from '../../components/BackgroundPattern'

interface SummarySectionProps {
  category: string
  title: string
  description: string
  benefits: string[]
}

export default function SummarySection(props: SummarySectionProps) {
  const { category, title, description, benefits } = props
  return (
    <Box position="relative" overflow="hidden">
      <BackgroundPattern />
      <Container maxW="3xl" color="gray.700" fontSize="md" lineHeight="7">
        <Flex flexDir="column" gap={4}>
          <Text
            fontWeight="semibold"
            color="primary.500"
            letterSpacing="tighter"
          >
            {category}
          </Text>

          <Heading
            as="h1"
            letterSpacing="tighter"
            color="gray.900"
            fontWeight="600"
          >
            {title}
          </Heading>

          <Text fontSize="xl" letterSpacing="tighter">
            {description}
          </Text>

          <Text mt={4}>With Plumber,</Text>

          <List maxW="xl" spacing={4} color="gray.600">
            {benefits.map((benefit) => (
              <ListItem key={benefit} display="flex" gap={3}>
                <ListIcon
                  as={BiSolidCheckCircle}
                  mt={1}
                  boxSize={5}
                  color="primary.500"
                  flexShrink={0}
                />
                <Box>
                  <Text color="gray.900">{benefit}</Text>
                </Box>
              </ListItem>
            ))}
          </List>
        </Flex>
      </Container>
    </Box>
  )
}
