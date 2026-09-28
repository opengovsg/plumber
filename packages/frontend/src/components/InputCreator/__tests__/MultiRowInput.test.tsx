// @vitest-environment jsdom
import type { IField } from '@plumber/types'

import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import {
  FieldValues,
  FormProvider,
  useForm,
  UseFormReturn,
} from 'react-hook-form'
import type { MockedResponse } from '@apollo/client/testing'
import { MockedProvider } from '@apollo/client/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import ThemeProvider from '@/components/ThemeProvider'
import { GET_DYNAMIC_DATA } from '@/graphql/queries/get-dynamic-data'

import MultiRowInput from '../MultiRowInput'

const STEP_ID = 'step-1'
const CASE_UUID = 'abcdefghijklmnopqrstuv'

// Mirrors the gathersg update-case `attachmentFields` argument.
const ATTACHMENT_FIELDS_SCHEMA = {
  label: 'Attachment fields',
  key: 'attachmentFields',
  type: 'multirow' as const,
  required: false,
  addRowButtonText: 'Add attachment field',
  subFields: [
    {
      label: 'Field',
      key: 'field',
      type: 'dropdown' as const,
      required: true,
      variables: false,
      hideWhenNoOptions: true,
      source: {
        type: 'query' as const,
        name: 'getDynamicData' as const,
        arguments: [
          { name: 'key', value: 'getCaseAttachmentFields' },
          { name: 'parameters.caseUuid', value: '{parameters.caseUuid}' },
        ],
      },
    },
    {
      label: 'Attachments',
      key: 'attachments',
      type: 'attachment' as const,
      required: true,
      variables: true,
      variableTypes: ['file'],
    },
  ] as IField[],
} satisfies IField & { subFields: IField[]; addRowButtonText?: string }

const noCaseMock: MockedResponse = {
  request: {
    query: GET_DYNAMIC_DATA,
    variables: { stepId: STEP_ID, key: 'getCaseAttachmentFields' },
  },
  result: { data: { getDynamicData: [] } },
}

const caseWithAttachmentFieldsMock: MockedResponse = {
  request: {
    query: GET_DYNAMIC_DATA,
    variables: {
      stepId: STEP_ID,
      key: 'getCaseAttachmentFields',
      parameters: { caseUuid: CASE_UUID },
    },
  },
  result: {
    data: {
      getDynamicData: [
        { name: 'Supporting documents', value: 'Supporting documents' },
      ],
    },
  },
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
let form: UseFormReturn | null

function Harness(): JSX.Element {
  const methods = useForm<FieldValues>({
    defaultValues: { parameters: { caseUuid: '', attachmentFields: [] } },
  })
  form = methods
  return (
    <FormProvider {...methods}>
      <input
        data-testid="case-uuid"
        {...methods.register('parameters.caseUuid')}
      />
      <MultiRowInput
        schema={ATTACHMENT_FIELDS_SCHEMA}
        computedName="parameters.attachmentFields"
        stepId={STEP_ID}
      />
    </FormProvider>
  )
}

function flushMacrotask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 2))
}

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await act(flushMacrotask)
  }
}

function typeCaseUuid(value: string): void {
  const input = container.querySelector<HTMLInputElement>(
    '[data-testid="case-uuid"]',
  )
  if (!input) {
    throw new Error('case uuid input not rendered')
  }
  // Bypass React's value tracker so the following input event is not
  // deduplicated as a no-op.
  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set
  nativeSetter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('MultiRowInput hideWhenNoOptions probe', () => {
  beforeEach(() => {
    ;(
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
    // Chakra's color mode and media query hooks need it, jsdom has no stub.
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia

    form = null
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('shows the block without a row once the case has attachment fields', async () => {
    await act(async () => {
      root.render(
        <ThemeProvider>
          <MockedProvider
            mocks={[noCaseMock, caseWithAttachmentFieldsMock]}
            addTypename={false}
          >
            <Harness />
          </MockedProvider>
        </ThemeProvider>,
      )
    })
    await settle()

    expect(container.textContent).not.toContain('Attachment fields')

    // Outside act(): react-hook-form runs its watch callbacks synchronously,
    // so the form value can be asserted before React renders anything.
    typeCaseUuid(CASE_UUID)

    // The probe must not write a phantom `{ field: null }` row into the form.
    expect(form?.getValues('parameters.attachmentFields')).toEqual([])

    await settle()

    expect(container.textContent).toContain('Attachment fields')
    expect(container.textContent).toContain('Add attachment field')
    expect(container.querySelector('[aria-label="Remove"]')).toBeNull()
    expect(form?.getValues('parameters.attachmentFields')).toEqual([])
  })
})
