import type { IField } from '@plumber/types'

import { Fragment, useCallback, useContext } from 'react'
import { Controller, useFieldArray, useFormContext } from 'react-hook-form'
import { BiPlus } from 'react-icons/bi'
import Markdown from 'react-markdown'
import { Flex } from '@chakra-ui/react'
import { Button, FormLabel } from '@opengovsg/design-system-react'

import { EditorContext } from '@/contexts/Editor'

import { InputCreatorProps } from '../InputCreator'
import MultiRow from '../MultiRow'

import { canAddGroup } from './helpers'
import OrDivider from './OrDivider'

export type GroupedMultiRowProps = {
  name: string
  subFields: IField[]
  required?: boolean
  label?: string
  description?: string
  maxGroups?: number
  maxRowsPerGroup?: number
  addRowButtonText?: string
  addGroupButtonText?: string
} & Omit<InputCreatorProps, 'schema' | 'namePrefix'>

/**
 * Generic "OR of AND" builder. It owns ONLY the group level — the array of
 * groups, the `+ Or` button, the OR dividers, and cap-driven disabling of
 * `+ Or`.
 *
 * Each group delegates its AND-rows to a reused `<MultiRow>` (rendered as
 * `multirow-multicol`), so leaf inputs, the variable picker, the empty-operator
 * `hiddenIf`, row add/delete, and the per-group row floor (>=1 row, via
 * `required`) are reused untouched. The group-level `+ Or` control is rendered
 * beside MultiRow's `+ And` via its `addButtonSuffix`. The persisted shape is
 * `[{ rows: [row, ...] }, ...]`.
 */
function GroupedMultiRow(props: GroupedMultiRowProps): JSX.Element {
  const {
    name,
    subFields,
    label,
    required,
    description,
    maxGroups,
    maxRowsPerGroup,
    addRowButtonText,
    addGroupButtonText,
    ...forwardedInputCreatorProps
  } = props

  const { control } = useFormContext()
  const { readOnly: isEditorReadOnly } = useContext(EditorContext)

  const { fields: groups, append } = useFieldArray({
    name,
    rules: { required },
  })

  const handleAddGroup = useCallback(() => {
    // A new group starts empty; MultiRow renders one blank row by default.
    append({ rows: [] })
  }, [append])

  return (
    <Controller
      name={name}
      control={control}
      render={(): JSX.Element => {
        // Empty-state guard: always render at least one group.
        const groupsToRender = groups.length
          ? groups
          : [{ id: `${name}-default-group` }]
        const canAdd = canAddGroup(groupsToRender.length, maxGroups)

        return (
          <Flex flexDir="column">
            <FormLabel
              isRequired={required}
              description={
                description && (
                  <Markdown linkTarget="_blank">{description}</Markdown>
                )
              }
            >
              {label}
            </FormLabel>

            {groupsToRender.map((group, index) => {
              const isLastGroup = index === groupsToRender.length - 1
              return (
                <Fragment key={group.id}>
                  <MultiRow
                    name={`${name}.${index}.rows`}
                    subFields={subFields}
                    required
                    type="multirow-multicol"
                    showDivider={false}
                    addRowButtonText={addRowButtonText ?? 'And'}
                    maxRows={maxRowsPerGroup}
                    addButtonSuffix={
                      // `+ Or` lives next to the last group's `+ And`.
                      isLastGroup && canAdd ? (
                        <Button
                          variant="outline"
                          leftIcon={<BiPlus />}
                          onClick={handleAddGroup}
                          isDisabled={isEditorReadOnly}
                          maxW="fit-content"
                        >
                          {addGroupButtonText ?? 'Or'}
                        </Button>
                      ) : undefined
                    }
                    {...forwardedInputCreatorProps}
                  />
                  {!isLastGroup && <OrDivider />}
                </Fragment>
              )
            })}
          </Flex>
        )
      }}
    />
  )
}

export default GroupedMultiRow
