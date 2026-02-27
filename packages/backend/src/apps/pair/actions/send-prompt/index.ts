import { IRawAction } from '@plumber/types'

const action: IRawAction = {
  name: 'Ask Pair',
  key: 'sendPrompt',
  description:
    'Enter a custom prompt to summarise, categorise or analyse data with Pair',
  arguments: [
    // TODO (kevinkim-ogp): each option should link to a different
    // default value for the prompt. update when the default value is provided
    {
      label: 'What would you like to do?',
      key: 'promptType',
      type: 'dropdown' as const,
      required: true,
      options: [
        { label: 'Analyse', value: 'analyse' },
        { label: 'Categorise', value: 'categorise' },
        { label: 'Summarise', value: 'summarise' },
        { label: 'Write', value: 'write' },
        {
          label: 'Custom prompt',
          value: 'custom',
          description: 'Do it yourself',
        },
      ],
      showOptionValue: false,
    },
    {
      label: 'Prompt',
      key: 'prompt',
      type: 'rich-text' as const,
      required: true,
      variables: true,
      customRteMenuOptions: [
        'Bold',
        'Italic',
        'Underline',
        'Divider', // specify when to show a divider
        'Heading1',
        'Heading2',
        'Heading3',
        'Heading4',
        'ListBullet',
        'ListOrdered',
        'Divider',
        'Undo',
        'Redo',
      ],
      // TODO (kevinkim-ogp): add the default value for the prompt
    },
    {
      label: 'How do you want the response?',

      key: 'responseFields',
      type: 'multirow-multicol' as const,
      required: true,
      hiddenIf: {
        fieldKey: 'promptType',
        op: 'is_empty',
      },
      subFields: [
        {
          placeholder: 'Field name',
          key: 'fieldName',
          type: 'string' as const,
          required: true,
          variables: false,
        },
        {
          placeholder: 'Field type',
          key: 'fieldType',
          type: 'dropdown' as const,
          required: true,
          showOptionValue: false,
          options: [
            { label: 'Text', value: 'text' },
            { label: 'Number', value: 'number' },
            { label: 'Category', value: 'category' },
          ],
        },
        {
          placeholder: 'Categories (comma-separated)',
          key: 'fieldCategories',
          type: 'string' as const,
          variables: true,
          hiddenIf: {
            fieldKey: 'fieldType',
            fieldValue: 'category',
            op: 'not_equals',
          },
          customStyle: { flex: 3 },
        },
      ],
      // TODO (kevinkim-ogp): add the default value for the response fields
    },
  ],

  // TODO (kevinkim-ogp): add the data out metadata

  async run($) {
    // TODO (kevinkim-ogp): add the validation for the parameters

    // TODO (kevinkim-ogp): add the dynamic schema for the response fields

    // TODO (kevinkim-ogp): add the generate object

    $.setActionItem({
      raw: { data: $.step.parameters },
    })
  },
}

export default action
