import type { IFieldMultiRowMultiColSubField } from '@plumber/types'

interface GetConditionArgsOptions {
  usePlaceholders: boolean
}

// FIXME (ogp-weeloong): migrate to multi-row for both ifThen and
// onlyContinueIf.
export default function getConditionArgs({
  usePlaceholders,
}: GetConditionArgsOptions): IFieldMultiRowMultiColSubField[] {
  const labelPropName = usePlaceholders ? 'placeholder' : 'label'

  return [
    {
      [labelPropName]: 'Field',
      key: 'field',
      type: 'string' as const,
      required: true,
      variables: true,
      customStyle: { flex: 3 },
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
      customStyle: { flex: 2 },
    },
    {
      [labelPropName]: 'Condition',
      key: 'condition',
      type: 'dropdown' as const,
      required: true,
      variables: false,
      showOptionValue: false,
      options: [
        {
          label: 'Equals to',
          value: 'equals',
        },
        { label: 'Empty', value: 'empty' },
        {
          label: 'Contains',
          value: 'contains',
          description: 'Used for text',
        },

        { label: 'Greater than', value: 'gt', description: 'Used for numbers' },
        {
          label: 'Greater than or equals to',
          value: 'gte',
          description: 'Used for numbers',
        },
        { label: 'Less than', value: 'lt', description: 'Used for numbers' },
        {
          label: 'Less than or equals to',
          value: 'lte',
          description: 'Used for numbers',
        },
        {
          label: 'Before',
          value: 'before',
          description: 'Used for dates',
        },
        {
          label: 'After',
          value: 'after',
          description: 'Used for dates',
        },
      ],
      customStyle: { flex: 2 },
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
        fieldValue: 'empty',
      },
      customStyle: { flex: 3 },
    },
  ]
}
