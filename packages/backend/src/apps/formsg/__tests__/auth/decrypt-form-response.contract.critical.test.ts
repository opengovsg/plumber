/**
 * Business rule:
 * "we shouldn't migrate or modify the paths - users should not have to change
 * their config for payload changes. payload changes should be backward
 * compatible."
 *
 * Saved pipes reference this output by text path, e.g. `fields.<id>.answer`.
 * The snapshot pins every key, property, array position and value format.
 *
 * When this test fails:
 * 1. Fix the code so every existing path resolves to the same value.
 * 2. Update the snapshot (`vitest -u`) only for an intended change. List the
 *    changed keys in the PR.
 *
 * IMPORTANT: adding a key is backward compatible. Changing or removing an
 * existing one is not. Confirm with the user before such a snapshot update.
 */
import { IGlobalVariable, IRequest } from '@plumber/types'
import { describe, expect, it, vi } from 'vitest'

import { decryptFormResponse } from '../../auth/decrypt-form-response'
import type { FormSchemaField } from '../../common/types'
import {
  exampleV4Submission,
  makeExampleV4FormSchema,
} from './v4-submission.mock'

const mocks = vi.hoisted(() => ({
  cryptoV3Decrypt: vi.fn(),
  fetchFormSchema: vi.fn(),
}))

vi.mock('@/helpers/logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

vi.mock('../../common/form-env', () => ({
  getSdk: () => ({
    webhooks: { authenticate: vi.fn() },
    cryptoV3: { decrypt: mocks.cryptoV3Decrypt },
  }),
  parseFormEnv: () => 'prod',
}))

vi.mock('../../triggers/new-submission/fetch-form-schema', () => ({
  fetchFormSchema: mocks.fetchFormSchema,
}))

const PROVENANCE = { submittedAt: '2026-06-02T05:00:53.879Z' }

// Shapes behind past incidents that the kitchen-sink form does not send.
const submission = {
  ...exampleV4Submission,
  responses: {
    ...exampleV4Submission.responses,
    ch1: {
      fieldType: 'children',
      question: '[MyInfo] Child records',
      answer: {
        child0: {
          value: {
            childname: { value: 'ALI LEE', myInfo: { attr: 'childname' } },
            childgender: { value: 'MALE', myInfo: { attr: 'childgender' } },
          },
        },
      },
      provenance: PROVENANCE,
    },
  },
  verified: {
    ...exampleV4Submission.verified,
    'cpUen (Step 1)': '200000000A',
    'cpUid (Step 1)': 'S1234567D',
  },
}

function makeSchema() {
  const extraFields: FormSchemaField[] = [
    { _id: 'optText', fieldType: 'textfield', title: 'Optional text' },
    { _id: 'optCheckbox', fieldType: 'checkbox', title: 'Optional checkbox' },
    {
      _id: 'ch1',
      fieldType: 'children',
      title: 'Child records',
      childrenSubFields: ['childname', 'childgender'],
    },
  ]
  const formFields: FormSchemaField[] = [
    ...makeExampleV4FormSchema().form.form_fields,
    ...extraFields,
  ]
  return { form: { form_fields: formFields } }
}

function makeGlobalVariable(): IGlobalVariable {
  return {
    request: {
      headers: { 'x-formsg-signature': 'signature' },
      body: {
        data: {
          submissionId: 'submissionId',
          formId: 'formId',
          created: '2026-06-02T05:00:53.879Z',
          version: 3,
        },
      },
    } as unknown as IRequest,
    auth: { data: { privateKey: 'secretkey' } },
    step: { id: 'stepId', parameters: {} },
    flow: { id: 'flowId', hasFileProcessingActions: false, isActive: true },
  } as unknown as IGlobalVariable
}

describe('FormSG v4 trigger output contract', () => {
  it('matches the saved snapshot', async () => {
    mocks.fetchFormSchema.mockResolvedValueOnce(makeSchema())
    mocks.cryptoV3Decrypt.mockReturnValueOnce(submission)
    const $ = makeGlobalVariable()

    const result = await decryptFormResponse($)

    expect(result).toEqual({ verified: true, internalId: 'submissionId' })
    await expect(JSON.stringify($.request.body, null, 2)).toMatchFileSnapshot(
      './__snapshots__/decrypt-form-response.contract.v4.json',
    )
  })
})
