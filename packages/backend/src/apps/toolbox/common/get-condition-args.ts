import type { IField } from '@plumber/types'

interface GetConditionArgsOptions {
  usePlaceholders: boolean
}

// FIXME (ogp-weeloong): migrate to multi-row for both ifThen and
// onlyContinueIf.
export default function getConditionArgs({
  usePlaceholders,
}: GetConditionArgsOptions): IField[] {
  const labelPropName = usePlaceholders ? 'placeholder' : 'label'

  return [
    {
      [labelPropName]: 'Field',
      key: 'field',
      type: 'string' as const,
      required: true,
      variables: true,
    },
    {
      [labelPropName]: 'Is or is not',
      key: 'is',
      type: 'dropdown' as const,
      required: true,
      variables: false,
      showOptionValue: false,
      options: [
        { label: 'Is', value: 'is' },
        { label: 'Is not', value: 'not' },
      ],
    },
    {
      [labelPropName]: 'Condition',
      key: 'condition',
      type: 'dropdown' as const,
      required: true,
      variables: false,
      showOptionValue: false,
      options: [
        { label: 'Equals to', value: 'equals' },
        { label: 'Greater than ', value: 'gt' },
        { label: 'Greater than or equals to', value: 'gte' },
        { label: 'Less than', value: 'lt' },
        { label: 'Less than or equals to', value: 'lte' },
        { label: 'Contains', value: 'contains' },
        { label: 'Is Empty', value: 'is_empty' },
      ],
    },
    {
      [labelPropName]: 'Value',
      key: 'text', // Legacy naming
      type: 'string' as const,
      required: true,
      variables: true,
      hiddenIf: {
        fieldKey: 'condition',
        op: 'equals',
        fieldValue: 'is_empty',
      },
    },
  ]
}
