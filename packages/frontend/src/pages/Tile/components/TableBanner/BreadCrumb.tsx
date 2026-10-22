import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Icon,
} from '@chakra-ui/react'
import { useCallback } from 'react'
import { BiChevronLeft } from 'react-icons/bi'
import { Link } from 'react-router-dom'

import EditableInput from '@/components/EditableInput'
import * as URLS from '@/config/urls'

import { useTableContext } from '../../contexts/TableContext'
import { useUpdateTable } from '../../hooks/useUpdateTable'

function BreadCrumb() {
  const { tableName: initialTableName, hasEditPermission } = useTableContext()
  const { updateTableName } = useUpdateTable()

  const onSave = useCallback(
    async (tableName: string) => {
      await updateTableName(tableName)
    },
    [updateTableName],
  )

  return (
    <Breadcrumb spacing={0} separator="">
      <BreadcrumbItem>
        <BreadcrumbLink
          as={Link}
          to={URLS.TILES}
          display="flex"
          alignItems="center"
          ml="-8px"
          mr={2}
          aria-label="Back to Tiles"
        >
          <Icon as={BiChevronLeft} boxSize={6} color="base.content.default" />
        </BreadcrumbLink>
      </BreadcrumbItem>
      <EditableInput
        value={initialTableName}
        fontWeight={500}
        onSave={onSave}
        readOnly={!hasEditPermission}
        maxWidth={['140px', '250px', '250px', '500px']}
        readOnlyWrapper={(children) => (
          <BreadcrumbLink
            pointerEvents={hasEditPermission ? 'auto' : 'none'}
            gap={3}
            overflow="hidden"
            alignItems="center"
            cursor="pointer"
            display="flex"
            role="group"
          >
            {children}
          </BreadcrumbLink>
        )}
        componentWrapper={(children) => (
          <BreadcrumbItem isCurrentPage>{children}</BreadcrumbItem>
        )}
      />
    </Breadcrumb>
  )
}

export default BreadCrumb
