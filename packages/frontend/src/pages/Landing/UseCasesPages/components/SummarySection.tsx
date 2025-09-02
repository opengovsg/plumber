import { BiSolidCheckCircle } from 'react-icons/bi'
import {
  Box,
  Flex,
  Heading,
  Image,
  List,
  ListIcon,
  ListItem,
  Text,
} from '@chakra-ui/react'

import Container from '@/components/Container'
import MarkdownRenderer from '@/components/MarkdownRenderer'

import BackgroundPattern from '../../components/BackgroundPattern'

interface SummarySectionProps {
  category: string
  title: string
  description: string
  benefits: string[]
  image?: string
}

export default function SummarySection(props: SummarySectionProps) {
  const { category, title, description, benefits, image } = props
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

          {image && (
            <Image
              src={image}
              minH={24}
              maxW={48}
              alt={title}
              objectFit="contain"
              filter="grayscale(100%)"
              opacity={0.7}
            />
          )}

          <Heading
            as="h1"
            letterSpacing="tighter"
            color="gray.900"
            fontWeight="600"
            fontFamily="'DM Sans', sans-serif"
          >
            {title}
          </Heading>

          <Text fontSize="xl" letterSpacing="tighter">
            {description}
          </Text>

          <Text mt={4}>With Plumber,</Text>

          <List spacing={4} color="gray.600">
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
                  <MarkdownRenderer source={benefit} />
                </Box>
              </ListItem>
            ))}
          </List>
        </Flex>
      </Container>
    </Box>
  )
}
