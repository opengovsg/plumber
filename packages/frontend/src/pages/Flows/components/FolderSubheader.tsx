import { Flex, Text } from '@chakra-ui/react'

import { FolderSelection, FolderSummary } from './FolderSidebar/FolderRow'

export interface FolderSubheaderProps {
  selection: FolderSelection
  folders: FolderSummary[]
  count: number
}

function pipeCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'pipe' : 'pipes'}`
}

function selectionTitle(
  selection: FolderSelection,
  folders: FolderSummary[],
): string {
  if (selection.type === 'all') {
    return 'All pipes'
  }
  if (selection.type === 'unfiled') {
    return 'Unfiled'
  }
  return (
    folders.find((folder) => folder.id === selection.folderId)?.name ?? 'Folder'
  )
}

// Confirms the current folder selection above the pipe list. This matters
// most on mobile, where the selected chip's highlight can scroll out of
// view, so the page title alone isn't enough to tell what's being shown.
export default function FolderSubheader(props: FolderSubheaderProps) {
  const { selection, folders, count } = props

  return (
    <Flex
      align="baseline"
      gap={2}
      borderBottom="1px solid"
      borderBottomColor="base.divider.medium"
      px={{ base: 4, md: 6 }}
      pb={3}
      mb={1}
    >
      <Text textStyle="subhead-1">{selectionTitle(selection, folders)}</Text>
      <Text textStyle="body-2" color="base.content.medium">
        {pipeCountLabel(count)}
      </Text>
    </Flex>
  )
}
