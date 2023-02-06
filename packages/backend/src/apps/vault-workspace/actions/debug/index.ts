import defineAction from '../../../../helpers/define-action';

export default defineAction({
  name: 'Debug action',
  key: 'debugAction',
  description: 'Debug action from the vault workspace.',
  arguments: [
    {
      label: 'Lookup Column Debugger',
      key: 'lookupColumn',
      type: 'dropdown' as const,
      required: true,
      variables: true,
      description:
        'Specify a column we should look for cells which match the Lookup Value.',
      source: {
        type: 'query',
        name: 'getDynamicData',
        arguments: [
          {
            name: 'key',
            value: 'listColumns',
          },
        ],
      },
    },
    {
      label: 'Previous Steps Variable Debugger',
      key: 'previousStepsVariable',
      type: 'string' as const,
      required: true,
      variables: true,
    },
  ],

  async run($) {
    const lookupColumn = $.step.parameters.lookupColumn as string;
    const previousStepsVariable = $.step.parameters
      .previousStepsVariable as string;

    console.log(lookupColumn);
    console.log(previousStepsVariable);
  },
});
