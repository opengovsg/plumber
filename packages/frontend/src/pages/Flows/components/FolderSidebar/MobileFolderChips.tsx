import { ReactNode } from 'react'
import { Box, Flex, HStack, Text } from '@chakra-ui/react'

import { FOLDER_COLORS } from './constants'
import { FolderSelection, FolderSummary } from './FolderRow'

export interface MobileFolderChipsProps {
  folders: FolderSummary[]
  totalFlowCount: number
  selection: FolderSelection
  onSelect: (selection: FolderSelection) => void
}

interface ChipProps {
  isSelected: boolean
  onClick: () => void
  ariaLabel?: string
  children: ReactNode
}

function Chip(props: ChipProps) {
  const { isSelected, onClick, ariaLabel, children } = props

  return (
    <Flex
      as="button"
      type="button"
      onClick={onClick}
      aria-current={isSelected || undefined}
      aria-label={ariaLabel}
      align="center"
      gap={1.5}
      flexShrink={0}
      borderRadius="full"
      border="1px solid"
      borderColor={isSelected ? 'primary.500' : 'base.divider.strong'}
      bg={isSelected ? 'primary.500' : 'transparent'}
      color={isSelected ? 'white' : 'base.content.default'}
      px={3}
      py={1.5}
      whiteSpace="nowrap"
    >
      {children}
    </Flex>
  )
}

export default function MobileFolderChips(props: MobileFolderChipsProps) {
  const { folders, totalFlowCount, selection, onSelect } = props
  const isAllSelected = selection.type === 'all'

  return (
    <HStack
      as="nav"
      aria-label="Folders"
      display={{ base: 'flex', md: 'none' }}
      spacing={2}
      overflowX="auto"
      borderBottom="1px solid"
      borderBottomColor="base.divider.medium"
      px={4}
      py={3}
    >
      <Chip
        isSelected={isAllSelected}
        onClick={() => onSelect({ type: 'all' })}
        ariaLabel={`All pipes, ${totalFlowCount} ${
          totalFlowCount === 1 ? 'pipe' : 'pipes'
        }`}
      >
        <Text
          textStyle="body-2"
          fontWeight={isAllSelected ? 500 : 400}
          color="inherit"
        >
          All pipes
        </Text>
      </Chip>

      {folders.map((folder) => {
        const isSelected =
          selection.type === 'folder' && selection.folderId === folder.id
        return (
          <Chip
            key={folder.id}
            isSelected={isSelected}
            onClick={() => onSelect({ type: 'folder', folderId: folder.id })}
          >
            <Box
              boxSize="7px"
              borderRadius="full"
              bg={isSelected ? 'white' : FOLDER_COLORS[folder.color].dot}
              flexShrink={0}
            />
            <Text
              textStyle="body-2"
              fontWeight={isSelected ? 500 : 400}
              color="inherit"
            >
              {folder.name} · {folder.flowCount}
            </Text>
          </Chip>
        )
      })}
    </HStack>
  )
}
