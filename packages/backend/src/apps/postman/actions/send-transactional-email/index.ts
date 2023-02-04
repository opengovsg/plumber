import defineAction from '../../../../helpers/define-action';

export default defineAction({
  name: 'Send transactional email',
  key: 'sendTransactionalEmail',
  description: 'Sends an email using Postman\'s transactional API.',
  arguments: [
    {
      label: 'Subject',
      key: 'subject',
      type: 'string' as const,
      required: true,
      description: 'Email subject.',
      variables: true,
    },
    {
      label: 'Body',
      key: 'body',
      type: 'string' as const,
      required: true,
      description: 'Email body HTML.',
      variables: true,
    },
    {
      label: 'Destination Email',
      key: 'destinationEmail',
      type: 'string' as const,
      required: true,
      description: 'Destination email address.',
      variables: true,
    },
    {
      label: 'Sender Name',
      key: 'senderName',
      type: 'string' as const,
      required: true,
      description: 'Sender name (will appear as \'<Name> via Postman\').',
      variables: true,
    },
  ],

  async run($) {
    const requestPath = '/v1/transactional/email/send';
    const { subject, body, destinationEmail, senderName } = $.step.parameters;
    const from = `${senderName} via Postman<donotreply@mail.postman.gov.sg>`;

    const response = await $.http.post(
      requestPath,
      { subject, body, recipient: destinationEmail, from },
    );

    const { status, recipient, params } = response.data;

    $.setActionItem({ raw: { status, recipient, ...params } });
  },
});
