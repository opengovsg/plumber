import type { IRawAction } from '@plumber/types'

import StepError from '@/errors/step'

//
// *DOCCENTRAL GUIDE*
// This is the core action object. It's basically an object specifying action
// details such as its name, configuration fields and its run() function.
//
const action: IRawAction = {
  name: 'Sample Action',
  key: 'sampleAction',
  description: 'A sample docCentral action',

  // *DOCCENTRAL GUIDE*
  // Each argument shows up as a form field when the user is configuring your
  // action in Plumber's UI.
  //
  // There are many types of form fields:
  // - Text
  // - Dropdown
  // - Multi-Select
  // - Multi-Row
  arguments: [
    {
      label: 'A Sample Text Field',
      key: 'sampleTextField',
      type: 'string' as const,
      required: true,

      // *DOCCENTRAL GUIDE*
      // Set this to true if you want to allow users to input variables from
      // previous steps (e.g. FormSG fields) into this field.
      variables: true,
    },
    {
      label: 'A Sample Dropdown Field',
      key: 'sampleDropDownField',
      type: 'dropdown' as const,
      required: true,
      description: `A sample drop down field`,
      value: 'GET',
      options: [
        { label: 'Option A', value: 'A' },
        { label: 'Option B', value: 'B' },
      ],
    },
    // *DOCCENTRAL GUIDE*
    // This is a multi-row field, which allows users to add an arbibtrary amount
    // of inputs (i.e. "rows"). It's similar to FormSG tables.
    {
      label: 'A Sample Multi-Row / Multi-Input Field',
      key: 'sampleMultiRowField',
      type: 'multirow' as const,
      required: false,
      // *DOCCENTRAL GUIDE*
      // This `subFields` property specifies what field should be in each row.
      // It's similar to FormSG tables.
      subFields: [
        {
          placeholder: 'Key',
          key: 'key',
          type: 'string' as const,
          required: true,
          variables: true,
        },
        {
          placeholder: 'Value',
          key: 'value',
          type: 'string' as const,
          required: true,
          variables: true,
        },
      ],
    },
  ],

  // *DOCCENTRAL GUIDE*
  // This is the callback that Plumber runs when a user adds your action to
  // their pipe. Note that this example uses typescript casting for brevity; we
  // actually recommend using zod to parse instead of casting stuff. See
  // `apps/paysg/actions/create-payment/index.ts` for an example on using zod.
  async run($) {
    // *DOCCENTRAL GUIDE*
    // You can grab sensitive info by accessing the `$.auth.data` object and
    // reading the desired data's key.
    //
    // For example, in the line below I am grabbing the `apiKey` field; this was
    // defined in `../../auth/index.ts`
    const apiKey = $.auth.data.apiKey as string

    // *DOCCENTRAL GUIDE*
    // You can grab the user's configured arguments (defined above) by accessing
    // the `$.step.parameters` object and reading the desired argument's key.
    //
    // For example, in the line below I am grabbing the text field's data and
    // the multi-row's data
    const textFieldData = $.step.parameters.sampleTextField as string

    try {
      // *DOCCENTRAL GUIDE*
      // You can make HTTP requests via `$.http`, which is an axios instance
      // whose base URL is set to the `baseUrl` from the app definition (see
      // `apps/doccentral/index.ts`).
      //
      // In the lines below, I am making a POST request to
      // 'https://doccentral.e01.app.gov.sg/api/v1/sample-action-endpoint'.
      const payload = {
        textField: textFieldData,
      }
      const response = await $.http.post(`sample-action-endpoint`, payload, {
        headers: {
          'x-api-key': apiKey,
        },
      })

      // *DOCCENTRAL GUIDE*
      // This `setActionItem` function is how Plumber steps expose variables
      // to later steps. Add whatever output you want to expose to the `raw`
      // property.
      //
      // In the example below, I am reading `sampleOutputA` and `sampleOutputB`
      // from the API's response, and exposing it as variables to later steps.
      $.setActionItem({
        raw: {
          sampleOutputA: response.data.sampleOutputA,
          sampleOutputB: response.data.sampleOutputB,
        },
      })
    } catch (error) {
      // *DOCCENTRAL GUIDE*
      // `StepError` is Plumber's error type. The 1st argument is the error
      // message, and the 2nd argument contains a suggested solution that is
      // shown the user to resolve the error.
      //
      // Feel free to customize these error messages.
      throw new StepError(
        `An error occurred: '${error.message}'`,
        'Please check that you have configured your step correctly',
        $.step.position,
        $.app.name,
      )
    }
  },
}

export default action
