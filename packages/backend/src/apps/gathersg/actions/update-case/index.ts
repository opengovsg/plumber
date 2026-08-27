import type {
  IGlobalVariable,
  IJSONArray,
  IJSONObject,
  IRawAction,
} from '@plumber/types'

import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import HttpError from '@/errors/http'
import StepError, { GenericSolution } from '@/errors/step'
import { ensureZodEnumValue } from '@/helpers/zod-utils'
import Step from '@/models/step'

import { uploadCaseAttachments } from '../../common/attachment'
import {
  fieldTypeEnum,
  GATHER_ATTACHMENT_FIELD_TYPE,
} from '../../common/constants'
import throwGatherSGStepError from '../../common/throw-errors'
import { GatherSGCase } from '../../common/types'

import { requestSchema, responseSchema } from './schema'

/**
 * Fetch the case's current uuids for an attachment field. Gather stores an
 * attachment field as the full array of file uuids, so we must read the
 * existing values and append to them — otherwise a PATCH would replace
 * (delete) the case's existing attachments.
 */
async function getExistingAttachmentUuids(
  $: IGlobalVariable,
  caseUuid: string,
  field: string,
): Promise<string[]> {
  const { data } = await $.http.get<{ data: GatherSGCase }>(
    '/cases/:caseUuid',
    {
      urlPathParams: { caseUuid },
    },
  )
  const existing = data.data.fields?.[field]
  return Array.isArray(existing)
    ? existing.filter((value): value is string => typeof value === 'string')
    : []
}

const action: IRawAction = {
  name: 'Update case',
  key: 'updateCase',
  description: 'Update a case based on the case uuid',
  arguments: [
    {
      label: 'Case UUID',
      key: 'caseUuid',
      type: 'string' as const,
      description: 'Select the case uuid you want to update.',
      required: true,
      variables: true,
      // we intentionally disable typing for case uuid as it is used in
      // to get dynamic data for case fields
      // it can still be pasted via mouse click
      singleVariableSelection: true,
    },
    {
      label: 'Case status',
      key: 'caseStatus',
      type: 'dropdown' as const,
      description: 'Select the status you want to update the case to.',
      required: false,
      variables: false,
      showOptionValue: false,
      source: {
        type: 'query' as const,
        name: 'getDynamicData' as const,
        arguments: [{ name: 'key', value: 'getCaseStatuses' }],
      },
    },
    {
      label: 'Case fields',
      key: 'caseFields',
      type: 'multirow-multicol' as const,
      autofillable: true,
      required: false,
      description:
        'Specify values for each field you want to update in your case. Note that fields that require an array of objects as a value are not supported yet.',

      subFields: [
        {
          placeholder: 'Field',
          key: 'field',
          type: 'dropdown' as const,
          showOptionValue: false,
          required: true,
          variables: false,
          allowArbitrary: true,
          source: {
            type: 'query' as const,
            name: 'getDynamicData' as const,
            arguments: [
              {
                name: 'key',
                value: 'getCaseFields',
              },
              {
                name: 'parameters.caseUuid',
                value: '{parameters.caseUuid}',
              },
            ],
          },
          customStyle: { flex: 2 },
        },
        {
          placeholder: 'Field type',
          key: 'fieldType',
          type: 'dropdown' as const,
          showOptionValue: false,
          required: true,
          value: 'string',
          variables: false,
          options: [
            {
              label: 'Text',
              value: ensureZodEnumValue(fieldTypeEnum, 'string'),
            },
            {
              label: 'Number',
              value: ensureZodEnumValue(fieldTypeEnum, 'number'),
            },
            {
              label: 'Email',
              value: ensureZodEnumValue(fieldTypeEnum, 'email'),
            },
            {
              label: 'Null',
              value: ensureZodEnumValue(fieldTypeEnum, 'null'),
            },
          ],
          customStyle: { flex: 1, maxWidth: 140 },
        },
        {
          placeholder: 'Value',
          key: 'value',
          type: 'string' as const,
          required: true,
          variables: true,
          hiddenIf: {
            fieldKey: 'fieldType',
            op: 'equals',
            fieldValue: 'null',
          },
          customStyle: { flex: 3, minWidth: 0, maxWidth: '60%' },
        },
      ],
    },
    {
      label: 'Attachment updates',
      key: 'attachmentUpdates',
      type: 'multirow' as const,
      required: false,
      addRowButtonText: 'Add attachment field',
      description:
        'Upload files to one or more attachment fields on the case.',
      subFields: [
        {
          label: 'Attachment field',
          key: 'field',
          type: 'dropdown' as const,
          required: true,
          description: 'Select the attachment field you want to upload files to.',
          variables: false,
          showOptionValue: false,
          source: {
            type: 'query' as const,
            name: 'getDynamicData' as const,
            arguments: [
              { name: 'key', value: 'getCaseAttachmentFields' },
              {
                name: 'parameters.caseUuid',
                value: '{parameters.caseUuid}',
              },
            ],
          },
        },
        {
          label: 'Update mode',
          key: 'replaceExisting',
          type: 'boolean-radio' as const,
          required: true,
          value: false,
          options: [
            {
              label: 'Add to existing attachments',
              description:
                'Keeps files already on the case for this field and adds the files selected here.',
              value: false,
            },
            {
              label: 'Replace existing attachments',
              description:
                'Sets this field to only the files selected here. Any existing files on the case for this field will be removed.',
              value: true,
            },
          ],
        },
        {
          label: 'Attachments',
          key: 'attachments',
          type: 'attachment' as const,
          required: true,
          variables: true,
          variableTypes: ['file'],
          hiddenIf: {
            fieldKey: 'field',
            op: 'is_empty',
          },
        },
      ],
    },
  ],

  doesFileProcessing: (step: Step) =>
    ((step.parameters.attachmentUpdates as IJSONArray | undefined) ?? []).some(
      (row) =>
        Array.isArray((row as IJSONObject).attachments) &&
        ((row as IJSONObject).attachments as IJSONArray).length > 0,
    ),

  async run($) {
    try {
      const { attachmentUpdates, ...patchBody } = requestSchema.parse(
        $.step.parameters,
      )

      if (attachmentUpdates.length > 0) {
        for (const {
          field,
          replaceExisting,
          attachments,
        } of attachmentUpdates) {
          const uuids = await uploadCaseAttachments({
            $,
            caseUuid: patchBody.caseUuid,
            field,
            fieldType: GATHER_ATTACHMENT_FIELD_TYPE,
            s3Ids: attachments,
          })

          const finalUuids = replaceExisting
            ? uuids
            : [
                ...new Set([
                  ...(await getExistingAttachmentUuids(
                    $,
                    patchBody.caseUuid,
                    field,
                  )),
                  ...uuids,
                ]),
              ]

          patchBody.fields = {
            ...(patchBody.fields ?? {}),
            [field]: finalUuids,
          } as Record<string, string | number | null>
        }
      }

      const rawResponse = await $.http.patch('/cases/:caseUuid', patchBody, {
        urlPathParams: {
          caseUuid: $.step.parameters.caseUuid,
        },
      })
      const response = responseSchema.parse(rawResponse.data)

      $.setActionItem({
        raw: {
          ...response,
        },
      })
    } catch (error) {
      if (error instanceof ZodError) {
        const firstError = fromZodError(error).details[0]
        throw new StepError(
          `${firstError.message}`,
          GenericSolution.ReconfigureInvalidField,
        )
      }

      if (error instanceof StepError) {
        throw error
      }

      if (error instanceof HttpError) {
        throwGatherSGStepError(error)
      }

      throw new StepError(
        `An error occurred: '${error.message}'`,
        'Please check that you have configured your step correctly',
      )
    }
  },
}

export default action
