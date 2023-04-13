import verifyCredentials from './verify-credentials'

export default {
  fields: [
    {
      key: 'label',
      label: 'Label',
      type: 'string' as const,
      required: true,
      readOnly: false,
      value: null,
      placeholder: null,
      clickToCopy: false,
    },
    {
      key: 'headers',
      label: 'Headers',
      type: 'multiline' as const,
      required: false,
      readOnly: false,
      value: null,
      placeholder: null,
      description:
        'Enter your headers in this format: KEY=VALUE (one per line)',
      clickToCopy: false,
    },
  ],

  verifyCredentials,
  isStillVerified: () => Promise.resolve(true),
}
