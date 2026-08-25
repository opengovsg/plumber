import {
  BiDotsHorizontalRounded,
  BiPalette,
  BiPencil,
  BiTrash,
} from 'react-icons/bi'
import {
  Box,
  Flex,
  Icon,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
} from '@chakra-ui/react'
import { IconButton } from '@opengovsg/design-system-react'

import { FOLDER_COLORS, FolderColor } from './constants'

export interface FolderSummary {
  id: string
  name: string
  color: FolderColor
  flowCount: number
}

// What's currently selected in the folder rail: everything, the unfiled
// bucket, or one specific folder. Shared by FolderSidebar and
// MobileFolderChips so both drive the same URL/query-param shape.
export type FolderSelection =
  | { type: 'all' }
  | { type: 'unfiled' }
  | { type: 'folder'; folderId: string }

interface FolderRowProps {
  folder: FolderSummary
  isSelected: boolean
  onSelect: (folderId: string) => void
  onRename: (folder: FolderSummary) => void
  onDelete: (folder: FolderSummary) => void
}

function pipeCountLabel(flowCount: number): string {
  return `${flowCount} ${flowCount === 1 ? 'pipe' : 'pipes'}`
}

export default function FolderRow(props: FolderRowProps) {
  const { folder, isSelected, onSelect, onRename, onDelete } = props

  return (
    <Flex role="group" position="relative" align="center" w="100%">
      <Flex
        as="button"
        type="button"
        onClick={() => onSelect(folder.id)}
        aria-current={isSelected || undefined}
        aria-label={`${folder.name}, ${pipeCountLabel(folder.flowCount)}`}
        align="center"
        gap={2}
        w="100%"
        minW={0}
        borderRadius={4}
        borderLeft="3px solid"
        borderLeftColor={isSelected ? 'primary.500' : 'transparent'}
        bg={isSelected ? 'primary.100' : 'transparent'}
        _hover={{
          bg: isSelected ? 'primary.100' : 'interaction.muted.neutral.hover',
        }}
        py={2}
        pl={2}
        pr={8}
        textAlign="left"
      >
        <Box
          boxSize="8px"
          borderRadius="full"
          bg={FOLDER_COLORS[folder.color].dot}
          flexShrink={0}
        />
        <Text
          flex={1}
          minW={0}
          isTruncated
          textStyle="body-2"
          fontWeight={isSelected ? 600 : 400}
          color={isSelected ? 'base.content.strong' : 'base.content.default'}
        >
          {folder.name}
        </Text>
        <Text
          flexShrink={0}
          textStyle="body-2"
          color={isSelected ? 'base.content.brand' : 'base.content.medium'}
        >
          {folder.flowCount}
        </Text>
      </Flex>

      <Menu placement="bottom-end" isLazy>
        <MenuButton
          as={IconButton}
          aria-label={`${folder.name} folder options`}
          icon={<BiDotsHorizontalRounded />}
          size="xs"
          variant="clear"
          colorScheme="secondary"
          position="absolute"
          right={1}
          top="50%"
          transform="translateY(-50%)"
          opacity={0}
          _groupHover={{ opacity: 1 }}
          _focus={{ opacity: 1 }}
          _focusVisible={{ opacity: 1 }}
        />
        <MenuList w="12rem">
          <MenuItem
            onClick={() => onRename(folder)}
            icon={<Icon as={BiPencil} boxSize={5} />}
          >
            Rename
          </MenuItem>
          <MenuItem
            onClick={() => onRename(folder)}
            icon={<Icon as={BiPalette} boxSize={5} />}
          >
            Change colour
          </MenuItem>
          <MenuItem
            onClick={() => onDelete(folder)}
            icon={<Icon as={BiTrash} boxSize={5} />}
            color="interaction.critical.default"
          >
            Delete
          </MenuItem>
        </MenuList>
      </Menu>
    </Flex>
  )
}
