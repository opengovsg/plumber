import type { IField } from '@plumber/types'

import { Fragment, useCallback, useContext, useMemo } from 'react'
import { Controller, useFieldArray, useFormContext } from 'react-hook-form'
import { BiPlus } from 'react-icons/bi'
import Markdown from 'react-markdown'
import { Flex } from '@chakra-ui/react'
import { Button, FormLabel } from '@opengovsg/design-system-react'

import { OR_CONDITION_FEATURE_FLAG } from '@/config/flags'
import { EditorContext } from '@/contexts/Editor'
import { LaunchDarklyContext } from '@/contexts/LaunchDarkly'

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

  const { control, getValues, setValue } = useFormContext()
  const { readOnly: isEditorReadOnly } = useContext(EditorContext)
  const { getFlagValue } = useContext(LaunchDarklyContext)
  // Gates the `+ Or` capability. When off, users can only build a single group
  // (pure AND) — identical to the legacy MultiRow behaviour. The persisted shape
  // and evaluator are unaffected; this only hides the group-add control.
  const canUseOrGroups = getFlagValue(OR_CONDITION_FEATURE_FLAG, false)

  const {
    fields: groups,
    append,
    remove,
  } = useFieldArray({
    name,
    rules: { required },
  })

  // react-hook-form needs a non-undefined default for every subfield of a new
  // row (mirrors MultiRow), otherwise it can repopulate it with deleted data.
  const newRowDefaultValue = useMemo(() => {
    const result: Record<string, unknown> = {}
    for (const subField of subFields) {
      result[subField.key] = subField.value ?? undefined
    }
    return result
  }, [subFields])

  const handleAddGroup = useCallback(() => {
    // Seed the new group with one row so focus lands on the first field. When
    // that field is a variable-enabled RTE, flag the row `isNew` so it
    // auto-focuses — same mechanism MultiRow uses for "+ And".
    const firstColIsRte =
      subFields?.[0]?.type === 'string' && subFields?.[0]?.variables
    append({
      rows: [
        firstColIsRte
          ? { ...newRowDefaultValue, isNew: true }
          : newRowDefaultValue,
      ],
    })
    // Mirrors MultiRow: a field array's `append`/`remove` update the form
    // value but don't fire the form's `watch` subject, so subscribers like
    // the step validator never recompute. Re-assert the already-updated
    // value through `setValue`, which does notify.
    setValue(name, getValues(name), {
      shouldDirty: true,
      shouldValidate: true,
    })
  }, [append, newRowDefaultValue, subFields, setValue, getValues, name])

  const handleRemoveGroup = useCallback(
    (index: number) => {
      remove(index)
      setValue(name, getValues(name), {
        shouldDirty: true,
        shouldValidate: true,
      })
    },
    [remove, setValue, getValues, name],
  )

  return (
    <Controller
      name={name}
      control={control}
      render={(): JSX.Element => {
        // Empty-state guard: always render at least one group.
        const groupsToRender = groups.length
          ? groups
          : [{ id: `${name}-default-group` }]
        const canAdd =
          canUseOrGroups && canAddGroup(groupsToRender.length, maxGroups)
        // Floor: at least one group with at least one row must always remain.
        // When more than one group exists, deleting a group's last row removes
        // the whole group; otherwise the last group's last row is undeletable.
        const canRemoveGroup = groupsToRender.length > 1

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
                    onRequestRemoveLastRow={
                      canRemoveGroup
                        ? () => handleRemoveGroup(index)
                        : undefined
                    }
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
