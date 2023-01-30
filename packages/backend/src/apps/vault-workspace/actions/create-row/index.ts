import defineAction from '../../../../helpers/define-action';
import createTableRow from '../../common/create-table-row';

// NOTE: this is just demo code, we are not using action yet.
export default defineAction({
  name: 'Create row',
  key: 'createRow',
  description: 'Creates a new row in Vault table.',
  arguments: [
    {
      label: 'Columns',
      key: 'columns',
      type: 'string' as const,
      required: true,
      variables: true,
    },
  ],

  async run($) {
    const rawRowData = $.step.parameters.columns as string;
    const columns = rawRowData.split(',');

    // construct back json
    const rowData: { [key: string]: string } = {};
    for (const column of columns) {
      const [key, value] = column.split('=');
      rowData[key] = value;
    }

    console.log(rowData);
    // await createTableRow($, rowData);
  },
});
