import { useCallback } from 'react'
import { FaChevronRight } from 'react-icons/fa'
import { Link } from 'react-router-dom'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Icon,
} from '@chakra-ui/react'

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
    <Breadcrumb
      spacing={4}
      separator={<Icon as={FaChevronRight} color="secondary.300" h={3} />}
    >
      <BreadcrumbItem>
        <BreadcrumbLink as={Link} to={URLS.TILES}>
          Tiles
        </BreadcrumbLink>
      </BreadcrumbItem>
      <EditableInput
        value={initialTableName}
        onSave={onSave}
        readOnly={!hasEditPermission}
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
