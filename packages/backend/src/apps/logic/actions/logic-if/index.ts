import CancelFlowError from '@/errors/cancel-flow'
import defineAction from '@/helpers/define-action'

export default defineAction({
  name: 'Only continue if...',
  key: 'if',
  description: 'Only continue if...',
  arguments: [
    {
      label: 'Field',
      key: 'field',
      type: 'string' as const,
      required: true,
      description: 'Field.',
      variables: true,
    },
    {
      label: 'Is',
      key: 'is',
      type: 'dropdown' as const,
      required: true,
      description: 'Is or Not',
      variables: false,
      options: [
        { label: 'Is', value: 'is' },
        { label: 'Not', value: 'not' },
      ],
    },
    {
      label: 'Condition',
      key: 'condition',
      type: 'dropdown' as const,
      required: true,
      description: 'Condition.',
      variables: false,
      options: [
        { label: '=', value: 'equals' },
        { label: '>=', value: 'gte' },
        { label: '>', value: 'gt' },
        { label: '<=', value: 'lte' },
        { label: '<', value: 'lt' },
        { label: 'contains', value: 'contains' },
      ],
    },
    {
      label: 'Text',
      key: 'text',
      type: 'string' as const,
      required: true,
      description: 'Text.',
      variables: true,
    },
  ],

  async run($) {
    const { field, is, condition, text } = $.step.parameters

    let result: boolean
    switch (condition) {
      case 'equals':
        result = field === text
        break
      case 'gte':
        result = Number(field) >= Number(text)
        break
      case 'gt':
        result = Number(field) > Number(text)
        break
      case 'lte':
        result = Number(field) <= Number(text)
        break
      case 'lt':
        result = Number(field) < Number(text)
        break
      case 'contains':
        result = field.toString().includes(text.toString())
        break
      default:
        throw new Error('Unknown predicate.')
    }

    if (is === 'not') {
      result = !result
    }

    // Debug purposes.
    $.setActionItem({
      raw: { result },
    })

    if (!result) {
      throw new CancelFlowError()
    }
  },
})
