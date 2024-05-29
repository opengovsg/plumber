import { KeyboardEvent, useCallback, useState } from 'react'
import { FaCheck, FaChevronRight, FaTimes } from 'react-icons/fa'
import { MdOutlineModeEdit } from 'react-icons/md'
import { Link } from 'react-router-dom'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Flex,
  Icon,
} from '@chakra-ui/react'
import { IconButton, Input } from '@opengovsg/design-system-react'
import * as URLS from 'config/urls'

import { useTableContext } from '../../contexts/TableContext'
import { useUpdateTable } from '../../hooks/useUpdateTable'

function BreadCrumb() {
  const { tableName: initialTableName, hasEditPermission } = useTableContext()
  const [isEditingTableName, setIsEditingTableName] = useState(false)
  const [tableName, setTableName] = useState(initialTableName)
  const { updateTableName, isUpdatingTableName } = useUpdateTable()

  const resetField = useCallback(() => {
    setTableName(initialTableName)
    setIsEditingTableName(false)
  }, [initialTableName])

  const onSave = useCallback(async () => {
    const trimmedTableName = tableName.trim()
    if (!trimmedTableName.length || trimmedTableName.length > 64) {
      resetField()
    } else {
      await updateTableName(tableName)
      setIsEditingTableName(false)
    }
  }, [resetField, tableName, updateTableName])

  const onEnter = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        onSave()
      }
      if (e.key === 'Escape') {
        resetField()
      }
    },
    [onSave, resetField],
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
      <BreadcrumbItem isCurrentPage>
        {isEditingTableName ? (
          <Flex
            alignItems="center"
            maxW={{ base: 'calc(100vw - 180px)', md: 'calc(100vw - 500px)' }}
            flex={1}
          >
            <Input
              autoFocus
              w="500px"
              maxLength={64}
              variant="flushed"
              value={tableName}
              onKeyDown={onEnter}
              onChange={(e) => setTableName(e.target.value)}
            />
            <IconButton
              ml={3}
              icon={<FaCheck size={14} />}
              aria-label="Save"
              isLoading={isUpdatingTableName}
              onClick={onSave}
              variant="clear"
              size="xs"
            />
            <IconButton
              icon={<FaTimes size={14} />}
              aria-label="Cancel"
              isDisabled={isUpdatingTableName}
              onClick={resetField}
              size="xs"
              variant="clear"
              colorScheme="secondary"
            />
          </Flex>
        ) : (
          <BreadcrumbLink
            onClick={() => setIsEditingTableName(true)}
            pointerEvents={hasEditPermission ? 'auto' : 'none'}
            gap={3}
            overflow="hidden"
            alignItems="center"
            cursor="pointer"
            display="flex"
            role="group"
          >
            {initialTableName}
            {hasEditPermission && (
              <IconButton
                icon={<MdOutlineModeEdit size={14} />}
                aria-label="Edit"
                size="xs"
                variant="clear"
                display="none"
                _groupHover={{
                  display: 'flex',
                }}
              />
            )}
          </BreadcrumbLink>
        )}
      </BreadcrumbItem>
    </Breadcrumb>
  )
}

export default BreadCrumb
