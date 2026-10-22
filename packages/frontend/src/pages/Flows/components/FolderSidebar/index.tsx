import type { IconType } from 'react-icons'
import { BiArchiveIn, BiGridAlt, BiPlus } from 'react-icons/bi'
import { Box, Flex, Icon, Text } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import FolderRow, { FolderSelection, FolderSummary } from './FolderRow'

export interface FolderSidebarProps {
  folders: FolderSummary[]
  totalFlowCount: number
  unfiledFlowCount: number
  selection: FolderSelection
  onSelect: (selection: FolderSelection) => void
  onCreate: () => void
  onRename: (folder: FolderSummary) => void
  onDelete: (folder: FolderSummary) => void
}

interface SidebarNavRowProps {
  icon: IconType
  label: string
  count: number
  isSelected: boolean
  onClick: () => void
}

function SidebarNavRow(props: SidebarNavRowProps) {
  const { icon, label, count, isSelected, onClick } = props

  return (
    <Flex
      as="button"
      type="button"
      onClick={onClick}
      aria-current={isSelected || undefined}
      aria-label={`${label}, ${count} ${count === 1 ? 'pipe' : 'pipes'}`}
      align="center"
      gap={2}
      w="100%"
      borderRadius={4}
      borderLeft="3px solid"
      borderLeftColor={isSelected ? 'primary.500' : 'transparent'}
      bg={isSelected ? 'primary.100' : 'transparent'}
      _hover={{
        bg: isSelected ? 'primary.100' : 'interaction.muted.neutral.hover',
      }}
      py={2}
      px={2}
      textAlign="left"
    >
      <Icon as={icon} boxSize={4} color="secondary.400" flexShrink={0} />
      <Text
        flex={1}
        minW={0}
        isTruncated
        textStyle="body-2"
        fontWeight={isSelected ? 600 : 400}
        color={isSelected ? 'base.content.strong' : 'base.content.default'}
      >
        {label}
      </Text>
      <Text
        flexShrink={0}
        textStyle="body-2"
        color={isSelected ? 'base.content.brand' : 'base.content.medium'}
      >
        {count}
      </Text>
    </Flex>
  )
}

export default function FolderSidebar(props: FolderSidebarProps) {
  const {
    folders,
    totalFlowCount,
    unfiledFlowCount,
    selection,
    onSelect,
    onCreate,
    onRename,
    onDelete,
  } = props

  return (
    <Box
      as="nav"
      aria-label="Folders"
      display={{ base: 'none', md: 'block' }}
      w="240px"
      flexShrink={0}
      borderRight="1px solid"
      borderRightColor="base.divider.medium"
      px={3}
      pb={6}
      pt={1}
    >
      <Text
        as="p"
        textStyle="subhead-3"
        color="base.content.medium"
        px={2}
        pt={3}
        pb={2}
      >
        Folders
      </Text>

      <Flex as="ul" flexDir="column" gap="2px" listStyleType="none">
        <Box as="li">
          <SidebarNavRow
            icon={BiGridAlt}
            label="All pipes"
            count={totalFlowCount}
            isSelected={selection.type === 'all'}
            onClick={() => onSelect({ type: 'all' })}
          />
        </Box>
        <Box as="li">
          <SidebarNavRow
            icon={BiArchiveIn}
            label="Unfiled"
            count={unfiledFlowCount}
            isSelected={selection.type === 'unfiled'}
            onClick={() => onSelect({ type: 'unfiled' })}
          />
        </Box>

        {folders.length > 0 && (
          <Box
            as="li"
            role="separator"
            h="1px"
            bg="base.divider.medium"
            my={2}
            mx={2}
          />
        )}

        {folders.map((folder) => (
          <Box as="li" key={folder.id}>
            <FolderRow
              folder={folder}
              isSelected={
                selection.type === 'folder' && selection.folderId === folder.id
              }
              onSelect={(folderId) => onSelect({ type: 'folder', folderId })}
              onRename={onRename}
              onDelete={onDelete}
            />
          </Box>
        ))}
      </Flex>

      <Button
        variant="clear"
        colorScheme="primary"
        leftIcon={<BiPlus />}
        onClick={onCreate}
        size="sm"
        justifyContent="flex-start"
        w="100%"
        mt={2}
      >
        New folder
      </Button>
    </Box>
  )
}
