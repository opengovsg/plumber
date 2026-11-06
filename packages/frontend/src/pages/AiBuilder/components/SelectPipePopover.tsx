import { useQuery } from '@apollo/client'
import {
  Box,
  Button,
  Flex,
  Input,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Spinner,
  Text,
  Tooltip,
  useDisclosure,
} from '@chakra-ui/react'
import { parsePipeId } from '@plumber/shared'
import debounce from 'lodash/debounce'
import { useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod'

import { PipeIcon } from '@/components/Icons'
import { GET_FLOWS } from '@/graphql/queries/get-flows'

import type { PipeChoice } from '../pipe-chip'

interface SelectPipePopoverProps {
  isStreaming: boolean
  onSelect: (choice: PipeChoice) => void
}

const flowListNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  active: z.boolean(),
  role: z.enum(['owner', 'editor', 'viewer']),
})

function readEditablePipe(node: unknown): PipeChoice | null {
  const parsed = flowListNodeSchema.safeParse(node)
  if (!parsed.success || parsed.data.role === 'viewer') {
    return null
  }
  const name = parsed.data.name.trim()
  if (!name) {
    return null
  }
  const pipeId = parsePipeId(parsed.data.id)
  if (!pipeId) {
    return null
  }
  return { pipeId, name, published: parsed.data.active }
}

export default function SelectPipePopover({
  isStreaming,
  onSelect,
}: SelectPipePopoverProps) {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const didFocusRef = useRef(false)

  const debounceSearch = useMemo(
    () => debounce((value: string) => setDebouncedSearch(value), 500),
    [],
  )

  useEffect(() => () => debounceSearch.cancel(), [debounceSearch])

  const handleClose = () => {
    debounceSearch.cancel()
    setSearchQuery('')
    setDebouncedSearch('')
    onClose()
  }

  const nameFilter = debouncedSearch.trim()
  const { data, loading, error } = useQuery(GET_FLOWS, {
    variables: {
      limit: 100,
      offset: 0,
      ...(nameFilter ? { name: nameFilter } : {}),
    },
    skip: !isOpen,
    fetchPolicy: 'cache-and-network',
  })

  const choices = useMemo(() => {
    const edges = data?.getFlows?.edges
    if (!Array.isArray(edges)) {
      return []
    }
    return edges.flatMap((edge: { node?: unknown }) => {
      const choice = readEditablePipe(edge?.node)
      return choice ? [choice] : []
    })
  }, [data])

  useEffect(() => {
    if (!isOpen) {
      didFocusRef.current = false
      return
    }
    if (!data || didFocusRef.current) {
      return
    }
    didFocusRef.current = true
    searchInputRef.current?.focus()
  }, [isOpen, data])

  const searchActive = searchQuery.trim().length > 0

  return (
    <Popover isOpen={isOpen} onClose={handleClose} placement="top-start" isLazy>
      <Tooltip
        label="Some workflows start from a pipe you already have. Select yours and I'll guide you based on its actual steps."
        hasArrow
        placement="top-start"
        isDisabled={isOpen}
      >
        <Flex display="inline-flex">
          <PopoverTrigger>
            <Button
              variant="outline"
              size="xs"
              borderRadius="full"
              color="gray.700"
              borderColor="gray.200"
              fontWeight="medium"
              px={2.5}
              leftIcon={<PipeIcon boxSize="14px" />}
              isDisabled={isStreaming}
              onClick={onOpen}
            >
              Select a pipe
            </Button>
          </PopoverTrigger>
        </Flex>
      </Tooltip>
      <PopoverContent w="320px" border="none" boxShadow="lg" borderRadius="lg">
        <PopoverBody p={2}>
          <Flex direction="column">
            <Text textStyle="caption-1" color="gray.500" px={2} py={1}>
              Choose a pipe
            </Text>
            <Input
              ref={searchInputRef}
              size="sm"
              mb={1}
              placeholder="Search pipes"
              value={searchQuery}
              onChange={(event) => {
                const value = event.target.value
                setSearchQuery(value)
                debounceSearch(value)
              }}
              aria-label="Search pipes"
            />
            <Flex direction="column" maxH="240px" overflowY="auto">
              {error && !data ? (
                <Text textStyle="body-2" color="gray.400" px={3} py={2}>
                  Couldn&apos;t load your pipes.
                </Text>
              ) : loading && !data ? (
                <Flex justify="center" py={3}>
                  <Spinner size="sm" color="primary.500" />
                </Flex>
              ) : choices.length === 0 ? (
                <Text textStyle="body-2" color="gray.400" px={3} py={2}>
                  {searchActive
                    ? 'No pipes match this search.'
                    : 'You have no pipes you can edit yet.'}
                </Text>
              ) : (
                choices.map((choice, idx) => (
                  <Box
                    key={choice.pipeId}
                    as="button"
                    type="button"
                    w="full"
                    textAlign="left"
                    px={3}
                    py={2}
                    borderRadius="md"
                    bg={idx % 2 === 0 ? 'gray.50' : 'white'}
                    aria-disabled={choice.published}
                    cursor={choice.published ? 'not-allowed' : 'pointer'}
                    _hover={choice.published ? {} : { bg: 'primary.50' }}
                    _active={choice.published ? {} : { bg: 'primary.100' }}
                    onClick={() => {
                      if (choice.published) {
                        return
                      }
                      handleClose()
                      onSelect(choice)
                    }}
                  >
                    <Text
                      textStyle="body-2"
                      whiteSpace="normal"
                      color={choice.published ? 'gray.400' : 'gray.800'}
                    >
                      {choice.name}
                    </Text>
                    {choice.published ? (
                      <Text textStyle="caption-1" color="gray.500">
                        Published. Unpublish it in the editor to edit it here.
                      </Text>
                    ) : null}
                  </Box>
                ))
              )}
            </Flex>
          </Flex>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  )
}
