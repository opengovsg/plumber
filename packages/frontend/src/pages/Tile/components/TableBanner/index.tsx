import { KeyboardEvent, useCallback, useState } from 'react'
import { FaCheck, FaChevronRight, FaPencilAlt, FaTimes } from 'react-icons/fa'
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

import { TABLE_BANNER_HEIGHT } from '../../constants'
import { useUpdateTable } from '../../hooks/useUpdateTable'

interface TableBannerProps {
  name: string
}

function TableBanner({ name }: TableBannerProps) {
  const [isEditingTableName, setIsEditingTableName] = useState(false)
  const [tableName, setTableName] = useState(name)
  const { updateTableName, isUpdatingTableName } = useUpdateTable()

  const resetField = useCallback(() => {
    setTableName(name)
    setIsEditingTableName(false)
  }, [name])

  const onSave = useCallback(async () => {
    await updateTableName(tableName)
    setIsEditingTableName(false)
  }, [tableName, updateTableName])

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
    <Flex px={8} h={TABLE_BANNER_HEIGHT} alignItems="center" overflow="hidden">
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
            <Flex alignItems="center" maxW="100%">
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
              gap={3}
              overflow="hidden"
              alignItems="center"
              cursor="pointer"
              display="flex"
              role="group"
            >
              {name}
              <IconButton
                icon={<FaPencilAlt size={14} />}
                aria-label="Edit"
                size="xs"
                variant="clear"
                display="none"
                _groupHover={{
                  display: 'flex',
                }}
              />
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
      </Breadcrumb>
    </Flex>
  )
}

export default TableBanner
