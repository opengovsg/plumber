import { Flex, Text } from '@chakra-ui/react'
import { Infobox } from '@opengovsg/design-system-react'

import { TOP_NAV_HEIGHT } from '@/config/layout'

import { useTableContext } from '../../contexts/TableContext'
import BreadCrumb from './BreadCrumb'
import EditMode from './EditMode'
import ImportExportToolbar from './ImportExportToolbar'
import RefreshButton from './RefreshButton'

function TableBanner() {
  const { tableName, role, isMigrating } = useTableContext()
  const isEditorRole = role === 'editor' || role === 'owner'

  return (
    <>
      {isMigrating && isEditorRole && (
        <Infobox variant="warning">
          This tile is being upgraded. Editing is paused and resumes
          automatically in a few minutes.
        </Infobox>
      )}
      <Flex
        px={{ base: 4, md: 8 }}
        h={TOP_NAV_HEIGHT}
        alignItems="center"
        justifyContent="space-between"
        overflow="hidden"
        zIndex={10}
      >
        <Flex alignItems="center" gap={8}>
          {role ? (
            <BreadCrumb />
          ) : (
            <Text textStyle="subhead-1">{tableName}</Text>
          )}
        </Flex>
        <Flex gap={2} mr={{ base: 0, md: '-15px' }}>
          <RefreshButton />
          <EditMode />
          <ImportExportToolbar />
        </Flex>
      </Flex>
    </>
  )
}

export default TableBanner
