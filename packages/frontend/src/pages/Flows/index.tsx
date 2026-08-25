import type { IFlow } from '@plumber/types'

import { ReactElement, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@apollo/client'
import { Box, Center, Flex, useDisclosure } from '@chakra-ui/react'
import { Pagination, useToast } from '@opengovsg/design-system-react'

import Container from '@/components/Container'
import DebouncedSearchInput from '@/components/DebouncedSearchInput'
import FlowRow from '@/components/FlowRow'
import NoResultFound from '@/components/NoResultFound'
import PageTitle from '@/components/PageTitle'
import PrimarySpinner from '@/components/PrimarySpinner'
import { CREATE_FLOW_FOLDER } from '@/graphql/mutations/create-flow-folder'
import { DELETE_FLOW_FOLDER } from '@/graphql/mutations/delete-flow-folder'
import { UPDATE_FLOW_FOLDER } from '@/graphql/mutations/update-flow-folder'
import { GET_FLOW_FOLDERS } from '@/graphql/queries/get-flow-folders'
import { GET_FLOWS } from '@/graphql/queries/get-flows'
import { GET_UNFILED_FLOW_COUNT } from '@/graphql/queries/get-unfiled-flow-count'
import { usePaginationAndFilter } from '@/hooks/usePaginationAndFilter'

import ApproveTransfersInfobox from './components/ApproveTransfersInfobox'
import CreateFlowModal from './components/CreateFlowModal'
import CreatePipeButton from './components/CreatePipeButton'
import EmptyFlows from './components/EmptyFlows'
import FolderSidebar from './components/FolderSidebar'
import {
  FolderColor,
  toFolderColor,
} from './components/FolderSidebar/constants'
import CreateFirstFolderPrompt from './components/FolderSidebar/CreateFirstFolderPrompt'
import DeleteFolderDialog from './components/FolderSidebar/DeleteFolderDialog'
import FolderFormModal from './components/FolderSidebar/FolderFormModal'
import {
  FolderSelection,
  FolderSummary,
} from './components/FolderSidebar/FolderRow'
import MobileFolderChips from './components/FolderSidebar/MobileFolderChips'
import FolderSubheader from './components/FolderSubheader'
import {
  CreateFlowContextProvider,
  FLOW_CREATE_MODE,
} from './contexts/CreateFlowContext'

const FLOWS_PER_PAGE = 10
const FLOWS_TITLE = 'Pipes'

interface FlowsInternalProps {
  isLoading: boolean
  isSearching: boolean
  isFolderFiltered: boolean
  selection: FolderSelection
  flows: IFlow[]
  showFolderChip: boolean
  onCreateModalOpen: () => void
}

const getLimitAndOffset = (page: number) => ({
  limit: FLOWS_PER_PAGE,
  offset: (page - 1) * FLOWS_PER_PAGE,
})

// The folder rail always needs "All pipes"/"Unfiled" counts regardless of
// which folder (if any) is currently selected, so they're derived here
// rather than from the (possibly folder-filtered) main flows query above.
function getFolderSelectionFromSearchParams(
  searchParams: URLSearchParams,
): FolderSelection {
  const folderId = searchParams.get('folderId')
  if (folderId) {
    return { type: 'folder', folderId }
  }
  if (searchParams.get('unfiled') === 'true') {
    return { type: 'unfiled' }
  }
  return { type: 'all' }
}

function FlowsList({
  isLoading,
  isSearching,
  isFolderFiltered,
  selection,
  flows,
  showFolderChip,
}: FlowsInternalProps) {
  const hasFlows = flows.length > 0
  const hasNoUserFlows = !hasFlows && !isSearching && !isFolderFiltered
  const isEmptySearchResults = !hasFlows && isSearching
  // Independent of `isSearching` - an empty folder/unfiled bucket is not a
  // search miss, so it gets its own copy rather than the generic "we
  // couldn't find anything" text.
  const isEmptyFolderResults = !hasFlows && !isSearching && isFolderFiltered

  if (isLoading) {
    return (
      <Center mt={8}>
        <PrimarySpinner fontSize="4xl" />
      </Center>
    )
  }

  if (hasNoUserFlows) {
    return <EmptyFlows />
  }

  if (isEmptySearchResults) {
    return (
      <NoResultFound
        description="We couldn't find anything"
        action="Try using different keywords or checking for typos."
      />
    )
  }

  if (isEmptyFolderResults) {
    return (
      <NoResultFound
        description="Nothing here yet"
        action={
          selection.type === 'unfiled'
            ? 'Every visible pipe already has a folder.'
            : 'This folder is empty.'
        }
      />
    )
  }
  return (
    <Box>
      {flows.map((flow) => (
        <FlowRow
          key={flow.id}
          flow={flow}
          showMenu={flow.role === 'owner'}
          showFolderChip={showFolderChip}
        />
      ))}
    </Box>
  )
}

export default function Flows(): ReactElement {
  const { input, page, setSearchParams, isSearching } = usePaginationAndFilter()
  const [rawSearchParams, setRawSearchParams] = useSearchParams()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [createMode, setCreateMode] = useState<FLOW_CREATE_MODE | null>(null)
  const toast = useToast()

  const selection = getFolderSelectionFromSearchParams(rawSearchParams)
  const isFolderFiltered = selection.type !== 'all'

  const handleFolderSelect = useCallback(
    (next: FolderSelection) => {
      setRawSearchParams((currentSearchParams) => {
        const params = new URLSearchParams(currentSearchParams)
        params.delete('folderId')
        params.delete('unfiled')
        // Changing folder always resets pagination back to page 1.
        params.delete('page')
        if (next.type === 'folder') {
          params.set('folderId', next.folderId)
        } else if (next.type === 'unfiled') {
          params.set('unfiled', 'true')
        }
        return params
      })
    },
    [setRawSearchParams],
  )

  const { data, loading } = useQuery(GET_FLOWS, {
    variables: {
      ...getLimitAndOffset(page),
      name: input,
      folderId: selection.type === 'folder' ? selection.folderId : undefined,
      unfiled: selection.type === 'unfiled' ? true : undefined,
    },
  })

  // Independent of the current folder selection/search, so the rail's
  // counts stay stable no matter what's currently being viewed. A single
  // dedicated field rather than a full `getFlows(unfiled: true, limit: 1)`
  // query, so reading one integer doesn't re-run the whole resolver.
  const { data: unfiledCountData } = useQuery(GET_UNFILED_FLOW_COUNT)

  const { data: foldersData, loading: foldersLoading } =
    useQuery(GET_FLOW_FOLDERS)
  const folders: FolderSummary[] = (foldersData?.getFlowFolders ?? []).map(
    (folder) => ({
      id: folder.id,
      name: folder.name,
      color: toFolderColor(folder.color),
      flowCount: folder.flowCount,
    }),
  )
  const hasFolders = folders.length > 0
  const unfiledFlowCount = unfiledCountData?.getUnfiledFlowCount ?? 0
  const totalFlowCount =
    unfiledFlowCount +
    folders.reduce((sum, folder) => sum + folder.flowCount, 0)

  const [createFlowFolder, { loading: isCreatingFolder }] = useMutation(
    CREATE_FLOW_FOLDER,
    { refetchQueries: ['GetFlowFolders'] },
  )
  // No `refetchQueries` here: `updateFlowFolder` already returns the
  // updated folder (id/name/color/flowCount), and `FlowFolder` has no
  // custom cache typePolicies, so Apollo's normalized cache merges it in.
  const [updateFlowFolder, { loading: isUpdatingFolder }] =
    useMutation(UPDATE_FLOW_FOLDER)
  const [deleteFlowFolder, { loading: isDeletingFolder }] = useMutation(
    DELETE_FLOW_FOLDER,
    { refetchQueries: ['GetFlowFolders', 'GetFlows', 'GetUnfiledFlowCount'] },
  )

  const {
    isOpen: isFolderFormOpen,
    onOpen: onFolderFormOpen,
    onClose: onFolderFormClose,
  } = useDisclosure()
  const [editingFolder, setEditingFolder] = useState<FolderSummary | null>(null)

  const {
    isOpen: isDeleteFolderOpen,
    onOpen: onDeleteFolderOpen,
    onClose: onDeleteFolderClose,
  } = useDisclosure()
  const [deletingFolder, setDeletingFolder] = useState<FolderSummary | null>(
    null,
  )

  const handleCreateFolder = useCallback(() => {
    setEditingFolder(null)
    onFolderFormOpen()
  }, [onFolderFormOpen])

  const handleRenameFolder = useCallback(
    (folder: FolderSummary) => {
      setEditingFolder(folder)
      onFolderFormOpen()
    },
    [onFolderFormOpen],
  )

  const handleDeleteFolder = useCallback(
    (folder: FolderSummary) => {
      setDeletingFolder(folder)
      onDeleteFolderOpen()
    },
    [onDeleteFolderOpen],
  )

  const handleFolderFormSubmit = useCallback(
    async (values: { name: string; color: FolderColor }) => {
      if (editingFolder) {
        await updateFlowFolder({
          variables: {
            input: {
              id: editingFolder.id,
              name: values.name,
              color: values.color,
            },
          },
          onCompleted: () => {
            toast({
              title: 'Folder updated.',
              status: 'success',
              duration: 3000,
              isClosable: true,
              position: 'top',
            })
            onFolderFormClose()
          },
        })
        return
      }

      await createFlowFolder({
        variables: { input: { name: values.name, color: values.color } },
        onCompleted: () => {
          toast({
            title: 'Folder created.',
            status: 'success',
            duration: 3000,
            isClosable: true,
            position: 'top',
          })
          onFolderFormClose()
        },
      })
    },
    [
      editingFolder,
      createFlowFolder,
      updateFlowFolder,
      onFolderFormClose,
      toast,
    ],
  )

  const handleDeleteFolderConfirm = useCallback(async () => {
    if (!deletingFolder) {
      return
    }
    const wasViewingDeletedFolder =
      selection.type === 'folder' && selection.folderId === deletingFolder.id

    await deleteFlowFolder({
      variables: { input: { id: deletingFolder.id } },
      onCompleted: () => {
        toast({
          title: `"${deletingFolder.name}" deleted. Its pipes moved to Unfiled.`,
          status: 'success',
          duration: 3000,
          isClosable: true,
          position: 'top',
        })
        onDeleteFolderClose()
        // The folder we were viewing no longer exists, so fall back to
        // "All pipes" rather than showing an empty filtered-on-nothing view.
        if (wasViewingDeletedFolder) {
          handleFolderSelect({ type: 'all' })
        }
      },
    })
  }, [
    deletingFolder,
    deleteFlowFolder,
    onDeleteFolderClose,
    selection,
    handleFolderSelect,
    toast,
  ])

  const { pageInfo, edges } = data?.getFlows || {}
  const flows: IFlow[] = edges?.map(({ node }: { node: IFlow }) => node) ?? []
  const totalCount: number = pageInfo?.totalCount ?? 0
  const hasPagination = !loading && totalCount > FLOWS_PER_PAGE
  const hasNoUserFlows = flows.length === 0 && !isSearching && !isFolderFiltered

  // ensure invalid pages won't be accessed even after deleting flows
  const lastPage = Math.ceil(totalCount / FLOWS_PER_PAGE)
  useEffect(() => {
    // Defer the search params update till after the initial render
    if (lastPage !== 0 && page > lastPage) {
      setSearchParams({ page: lastPage })
    }
  }, [lastPage, page, setSearchParams])

  // A `?folderId=` that's been deleted, or belongs to someone else, would
  // otherwise silently render an empty list with no explanation. Once we
  // know for sure (folders have loaded) that the id isn't one of this
  // user's folders, fall back to "All pipes" rather than showing that as a
  // search miss.
  useEffect(() => {
    if (foldersLoading || selection.type !== 'folder') {
      return
    }
    if (folders.some((folder) => folder.id === selection.folderId)) {
      return
    }
    handleFolderSelect({ type: 'all' })
    toast({
      title: "That folder couldn't be found. Showing all pipes.",
      status: 'info',
      duration: 3000,
      isClosable: true,
      position: 'top',
    })
  }, [foldersLoading, folders, selection, handleFolderSelect, toast])

  return (
    <CreateFlowContextProvider
      createMode={createMode}
      setCreateMode={setCreateMode}
    >
      <Container py={9}>
        {!hasNoUserFlows && (
          <PageTitle
            title={FLOWS_TITLE}
            searchComponent={
              <DebouncedSearchInput
                searchValue={input}
                onChange={(input) => setSearchParams({ input })}
              />
            }
            createComponent={<CreatePipeButton onOpen={onOpen} />}
          />
        )}

        <ApproveTransfersInfobox />

        {/*
          A user with no folders must see today's Pipes page, byte-for-byte
          unchanged - no rail, no mobile chip row, no layout shift. So the
          rail/chips/subheader only render once we know (folders have
          loaded) that the user actually has at least one folder; while
          that's still loading they render as before, to avoid a flash of
          "empty" for users who do have folders. Folder creation stays
          discoverable via the prompt below instead of a permanent rail.
        */}
        {!foldersLoading && !hasFolders ? (
          <CreateFirstFolderPrompt onCreate={handleCreateFolder} />
        ) : null}

        <Flex align="flex-start" gap={{ base: 0, md: 6 }}>
          {(foldersLoading || hasFolders) && (
            <FolderSidebar
              folders={folders}
              totalFlowCount={totalFlowCount}
              unfiledFlowCount={unfiledFlowCount}
              selection={selection}
              onSelect={handleFolderSelect}
              onCreate={handleCreateFolder}
              onRename={handleRenameFolder}
              onDelete={handleDeleteFolder}
            />
          )}

          <Box flex={1} minW={0}>
            {(foldersLoading || hasFolders) && (
              <>
                <MobileFolderChips
                  folders={folders}
                  totalFlowCount={totalFlowCount}
                  unfiledFlowCount={unfiledFlowCount}
                  selection={selection}
                  onSelect={handleFolderSelect}
                />
                <FolderSubheader
                  selection={selection}
                  folders={folders}
                  count={totalCount}
                />
              </>
            )}

            <FlowsList
              flows={flows}
              isLoading={loading}
              isSearching={isSearching}
              isFolderFiltered={isFolderFiltered}
              selection={selection}
              showFolderChip={!isFolderFiltered}
              onCreateModalOpen={onOpen}
            />

            {hasPagination && (
              <Flex justifyContent="center" mt={6}>
                <Pagination
                  currentPage={pageInfo?.currentPage}
                  onPageChange={(page) => setSearchParams({ page })}
                  pageSize={FLOWS_PER_PAGE}
                  totalCount={totalCount}
                />
              </Flex>
            )}
          </Box>
        </Flex>

        {isOpen && (
          <CreateFlowModal
            onClose={() => {
              onClose()
              setCreateMode(null)
            }}
          />
        )}

        <FolderFormModal
          isOpen={isFolderFormOpen}
          folder={editingFolder}
          isSubmitting={isCreatingFolder || isUpdatingFolder}
          onClose={onFolderFormClose}
          onSubmit={handleFolderFormSubmit}
        />

        <DeleteFolderDialog
          isOpen={isDeleteFolderOpen}
          folder={deletingFolder}
          isDeleting={isDeletingFolder}
          onClose={onDeleteFolderClose}
          onConfirm={handleDeleteFolderConfirm}
        />
      </Container>
    </CreateFlowContextProvider>
  )
}
