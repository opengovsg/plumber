export const FEEDBACK_POPOVER_DETAILS = {
  positive: {
    dropdownLabel: null,
    dropdownOptions: null,
    textAreaLabel:
      'Provide details on what was satisfying about this response:',
    textAreaPlaceholder: 'What was satisfying about this response?',
    score: 1,
  },
  negative: {
    dropdownLabel: 'What type of issue do you wish to report?',
    dropdownOptions: [
      'Incorrect workflow generated',
      'Incomplete response',
      'UI bug',
      "I don't understand the response",
      'Other',
    ],
    textAreaLabel: 'Provide details on what was wrong with this response:',
    textAreaPlaceholder: 'What was wrong with this response?',
    score: 0,
  },
}
